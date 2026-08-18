import hashlib
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.recipe import RecipeCache
from app.services.llm import llm_service
from app.utils.cache import cache

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> str:
    """Strip markdown fences, thinking tags, and extract raw JSON from LLM output."""
    import re

    cleaned = text.strip()
    cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL)
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        return cleaned[start : end + 1]
    return cleaned

VARIANT_SYSTEM_PROMPT = """You are a professional nutritionist and chef assistant.
The user will give you an existing recipe and ask you to modify it according to a specific variation.

Rules:
- Keep the same recipe structure and JSON format.
- Apply the requested variation accurately (e.g., replace meat with plant-based protein for vegetarian).
- Maintain nutritional accuracy — recalculate calories and macros if ingredients change significantly.
- Keep pantry staples (salt, pepper, olive oil) as needed.
- Return strictly valid JSON. No markdown fences, no commentary outside the JSON.
- Do NOT include any thinking or reasoning in your response. Output the JSON directly.
- The JSON must be a single object (NOT wrapped in an array or "recipes" key) with exactly these fields:
  title (string), summary (string), calories_per_serving (number|null), prep_time_minutes (number|null), servings (number),
  ingredients (array of strings), steps (array of strings), macros (object with protein, carbs, fat in grams | null),
  tags (array of strings), missing_ingredients (array of strings), tip (string|null).
- Respond in the language requested. If none is specified, use Arabic.
"""

VARIATION_PRESETS: dict[str, dict[str, str]] = {
    "vegetarian": {
        "ar": "حوّل الوصفة إلى نباتي: استبدل اللحوم والدواجن بمكونات نباتية بروتينية مثل الحمص، التوفو، أو البقوليات.",
        "en": "Convert to vegetarian: replace meat and poultry with plant-based protein sources like chickpeas, tofu, or legumes.",
    },
    "vegan": {
        "ar": "حوّل الوصفة إلى نباتي كامل: أزل جميع منتجات الحيوان (لحوم، بيض، حليب، جبنة) واستبدلها ببدائل نباتية.",
        "en": "Convert to fully vegan: remove all animal products (meat, eggs, milk, cheese) and replace with vegan alternatives.",
    },
    "gluten_free": {
        "ar": "خلّيها خالية من الغلوتين: استبدل أي مكونات تحتوي غلوتين (خبز، معجون، صلصة الصويا) ببدائل خالية.",
        "en": "Make it gluten-free: replace any gluten-containing ingredients (bread, pasta, soy sauce) with gluten-free alternatives.",
    },
    "lower_calorie": {
        "ar": "قلّل السعرات الحرارية: استبدل المكونات عالية السعرات بخيارات أخف مع الحفاظ على النكهة والطعم.",
        "en": "Reduce calories: replace high-calorie ingredients with lighter options while maintaining flavor.",
    },
    "higher_protein": {
        "ar": "زِد البروتين: أضف مصادر بروتين إضافية أو استبدل مكونات بخيارات أعلى بروتين.",
        "en": "Increase protein: add extra protein sources or swap for higher-protein alternatives.",
    },
    "spicier": {
        "ar": "زِد الحارّية: أضف توابل وفلفل حار لجعل الوصفة أكثر حرارة مع الحفاظ على التوازن.",
        "en": "Make it spicier: add hot peppers and spices to increase heat while maintaining balance.",
    },
    "dairy_free": {
        "ar": "خلّيها خالية من منتجات الألبان: أزل الحليب والجبنة والزبدة واستبدلها ببدائل نباتية.",
        "en": "Make it dairy-free: remove milk, cheese, and butter, replace with dairy-free alternatives.",
    },
    "quick_version": {
        "ar": "نسخة أسرع: عدّل الوصفة لتكون أسرع في التحضير (أقل من 20 دقيقة) مع الحفاظ على الجودة.",
        "en": "Quick version: adapt for faster prep (under 20 minutes) while keeping quality.",
    },
    "budget_friendly": {
        "ar": "صديق للميزانية: استبدل المكونات الغالية بخيارات أرخص ومتوفرة مع الحفاظ على الطعم والقيمة الغذائية.",
        "en": "Budget-friendly: replace expensive ingredients with cheaper, accessible ones while keeping taste and nutrition.",
    },
}


def build_variant_user_prompt(
    recipe_dict: dict,
    variation: str,
    *,
    language: str | None = None,
) -> str:
    import json

    recipe_json = json.dumps(recipe_dict, ensure_ascii=False, indent=2)

    variation_lower = variation.strip().lower()
    if variation_lower in VARIATION_PRESETS:
        lang = language if language in {"ar", "en"} else "ar"
        instruction = VARIATION_PRESETS[variation_lower][lang]
    else:
        instruction = variation

    parts = [f"Original recipe:\n{recipe_json}", f"Variation requested: {instruction}"]
    if language in {"en", "ar"}:
        lang_name = "English" if language == "en" else "Arabic"
        parts.append(f"Respond ONLY in {lang_name}.")
    parts.append("Return exactly ONE modified recipe as a JSON object (not wrapped in any key).")
    return "\n\n".join(parts)

SYSTEM_PROMPT = """You are a professional nutritionist and chef assistant inside a smart meal-planning app.
Given the user's available ingredients, dietary preferences, and calorie target, propose healthy, practical recipes.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown fences, no commentary, no explanation, no text before or after the JSON.
- The ENTIRE response must be a single JSON object starting with { and ending with }.
- Do NOT include any thinking or reasoning in your response. Output the JSON directly.
- The JSON must be: {"recipes": [ ... ] } where each recipe has exactly these fields:
  title (string), summary (string), calories_per_serving (number|null), prep_time_minutes (number|null), servings (number),
  ingredients (array of strings), steps (array of strings), macros (object with protein, carbs, fat in grams | null),
  tags (array of strings), missing_ingredients (array of strings), tip (string|null).
- Respond in the language requested in the user message. If none is specified, use Arabic.
"""


def build_user_prompt(
    ingredients: list[str],
    *,
    calorie_target: float | None = None,
    meal_type: str | None = None,
    count: int = 3,
    dietary_preferences: str | None = None,
    language: str | None = None,
    avoid_titles: list[str] | None = None,
) -> str:
    parts = [f"Available ingredients: {', '.join(ingredients) or '(none listed)'}"]
    if language in {"en", "ar"}:
        lang_name = "English" if language == "en" else "Arabic"
        parts.append(f"Respond ONLY in {lang_name}.")
    if calorie_target:
        parts.append(f"Calorie target per serving: approximately {int(calorie_target)} kcal.")
    if meal_type:
        parts.append(f"Meal type: {meal_type}.")
    if dietary_preferences:
        parts.append(f"Dietary preferences: {dietary_preferences}.")
    if avoid_titles:
        parts.append(
            "The user recently ate these dishes — do NOT propose any of them, choose different recipes: "
            + ", ".join(avoid_titles[:20])
            + "."
        )
    parts.append(f"Propose {count} recipes.")
    return "\n".join(parts)


def build_cache_key(
    ingredients: list[str],
    calorie_target: float | None,
    meal_type: str | None,
    count: int,
    dietary_preferences: str | None,
    language: str | None,
    avoid_titles: list[str] | None = None,
) -> str:
    raw = json.dumps(
        {
            "i": sorted(x.strip().lower() for x in ingredients if x.strip()),
            "c": calorie_target,
            "m": meal_type,
            "n": count,
            "d": dietary_preferences,
            "l": language,
            "a": sorted(x.strip().lower() for x in (avoid_titles or [])),
        },
        sort_keys=True,
    )
    return "recipes:" + hashlib.sha256(raw.encode()).hexdigest()


async def get_cached_payload(db: AsyncSession, cache_key: str) -> dict | None:
    cached = await cache.get(cache_key)
    if cached:
        return cached

    age_limit = datetime.utcnow() - timedelta(hours=settings.LLM_MAX_CACHE_AGE_HOURS)
    result = await db.execute(
        select(RecipeCache).where(
            RecipeCache.cache_key == cache_key,
            RecipeCache.created_at >= age_limit,
        )
    )
    row = result.scalar_one_or_none()
    return row.get_payload() if row else None


async def store_payload(db: AsyncSession, cache_key: str, payload: dict) -> None:
    await cache.set(cache_key, payload, ttl_seconds=settings.LLM_MAX_CACHE_AGE_HOURS * 3600)
    result = await db.execute(select(RecipeCache).where(RecipeCache.cache_key == cache_key))
    row = result.scalar_one_or_none()
    if row:
        row.payload = json.dumps(payload, ensure_ascii=False)
    else:
        db.add(RecipeCache(cache_key=cache_key, payload=json.dumps(payload, ensure_ascii=False)))
    await db.commit()


async def suggest_recipes(
    db: AsyncSession,
    *,
    ingredients: list[str],
    calorie_target: float | None = None,
    meal_type: str | None = None,
    count: int = 3,
    dietary_preferences: str | None = None,
    language: str | None = None,
    avoid_titles: list[str] | None = None,
) -> tuple[dict, str]:
    cache_key = build_cache_key(
        ingredients, calorie_target, meal_type, count, dietary_preferences, language, avoid_titles
    )

    cached = await get_cached_payload(db, cache_key)
    if cached is not None:
        return cached, "cache"

    if not llm_service.is_configured:
        raise RuntimeError(
            "LLM_API_KEY is not configured. Set it in backend/.env to enable AI recipe generation."
        )

    response_text = await llm_service.complete(
        SYSTEM_PROMPT,
        build_user_prompt(
            ingredients,
            calorie_target=calorie_target,
            meal_type=meal_type,
            count=count,
            dietary_preferences=dietary_preferences,
            language=language,
            avoid_titles=avoid_titles,
        ),
    )

    try:
        payload = json.loads(_extract_json(response_text))
    except json.JSONDecodeError:
        logger.warning("First parse failed, retrying with stricter prompt: %s", response_text[:200])
        response_text = await llm_service.complete(
            "Return ONLY a JSON object. No thinking, no text, no markdown, no explanation. Start with { and end with }.",
            build_user_prompt(
                ingredients,
                calorie_target=calorie_target,
                meal_type=meal_type,
                count=count,
                dietary_preferences=dietary_preferences,
                language=language,
                avoid_titles=avoid_titles,
            )
            + "\n\nIMPORTANT: Return ONLY the JSON object. Start with { and end with }. No other text.",
        )
        try:
            payload = json.loads(_extract_json(response_text))
        except json.JSONDecodeError as exc:
            logger.error("LLM returned invalid JSON after retry: %s", response_text)
            raise RuntimeError("The recipe engine returned an invalid response. Please try again.") from exc

    payload.setdefault("recipes", [])
    await store_payload(db, cache_key, payload)
    return payload, "ai"


async def generate_variant(
    db: AsyncSession,
    *,
    recipe_dict: dict,
    variation: str,
    language: str | None = None,
) -> tuple[dict, str]:
    if not llm_service.is_configured:
        raise RuntimeError(
            "LLM_API_KEY is not configured. Set it in backend/.env to enable AI recipe generation."
        )

    response_text = await llm_service.complete(
        VARIANT_SYSTEM_PROMPT,
        build_variant_user_prompt(recipe_dict, variation, language=language),
        temperature=0.7,
        max_tokens=4096,
    )

    try:
        payload = json.loads(_extract_json(response_text))
    except json.JSONDecodeError as exc:
        logger.error("LLM returned invalid JSON for variant: %s", response_text)
        raise RuntimeError("The recipe engine returned an invalid response. Please try again.") from exc

    if "recipes" in payload:
        payload = payload["recipes"][0] if payload["recipes"] else payload

    return payload, "ai"
