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

SYSTEM_PROMPT = """You are a professional nutritionist and chef assistant inside a smart meal-planning app.
Given the user's available ingredients, dietary preferences, and calorie target, propose healthy, practical recipes.

Rules:
- Prefer recipes that use ONLY the provided available ingredients. A few common pantry staples (salt, pepper, olive oil, water) are always allowed and should not be reported as missing.
- If an ingredient is essential but not available, it may be listed in "missing_ingredients" so the user knows what to buy.
- Return strictly valid JSON. No markdown fences, no commentary outside the JSON.
- The JSON must be an object: {"recipes": [ ... ] } where each recipe has exactly these fields:
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
    parts.append(f"Propose {count} recipes.")
    return "\n".join(parts)


def build_cache_key(ingredients: list[str], calorie_target: float | None, meal_type: str | None, count: int, dietary_preferences: str | None, language: str | None) -> str:
    raw = json.dumps(
        {
            "i": sorted(x.strip().lower() for x in ingredients if x.strip()),
            "c": calorie_target,
            "m": meal_type,
            "n": count,
            "d": dietary_preferences,
            "l": language,
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
) -> tuple[dict, str]:
    cache_key = build_cache_key(ingredients, calorie_target, meal_type, count, dietary_preferences, language)

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
        ),
    )

    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned invalid JSON: %s", response_text)
        raise RuntimeError("The recipe engine returned an invalid response. Please try again.") from exc

    payload.setdefault("recipes", [])
    await store_payload(db, cache_key, payload)
    return payload, "ai"
