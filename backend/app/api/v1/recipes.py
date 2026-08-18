import logging
from datetime import date, timedelta
from typing import Annotated

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.models.meal import MealLog
from app.models.recipe import SavedRecipe
from app.schemas.recipe import (
    RecipeOut,
    RecipeSuggestionRequest,
    RecipeSuggestionResponse,
    RecipeVariantRequest,
    SaveRecipeRequest,
    SavedRecipeOut,
)
from app.services.recipes import suggest_recipes, generate_variant
from app.services.llm import llm_service
from app.services.quota import check_and_consume_quota

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipes", tags=["recipes"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _resolve_ingredients(
    db: AsyncSession,
    current_user,
    request: RecipeSuggestionRequest,
) -> list[str]:
    names: list[str] = []
    if request.ingredients:
        names.extend(request.ingredients)
    if request.ingredient_ids:
        result = await db.execute(
            select(FridgeItem).where(
                FridgeItem.id.in_(request.ingredient_ids),
                FridgeItem.user_id == current_user.id,
            )
        )
        names.extend(item.name for item in result.scalars().all())
    if not names:
        result = await db.execute(
            select(FridgeItem).where(FridgeItem.user_id == current_user.id)
        )
        names.extend(item.name for item in result.scalars().all())
    return names


@router.post("/suggest", response_model=RecipeSuggestionResponse)
async def suggest(
    request: RecipeSuggestionRequest,
    current_user: CurrentUser,
    db: Db,
) -> RecipeSuggestionResponse:
    ingredients = await _resolve_ingredients(db, current_user, request)
    if not ingredients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No ingredients provided. Add fridge items or list ingredients.",
        )

    target = request.calorie_target or current_user.calorie_target

    recent_start = date.today() - timedelta(days=7)
    recent_result = await db.execute(
        select(MealLog.title)
        .where(
            MealLog.user_id == current_user.id,
            MealLog.eaten_on >= recent_start,
        )
        .distinct()
    )
    avoid_titles = [title for title in recent_result.scalars().all() if title]

    try:
        await check_and_consume_quota(current_user)
        payload, source = await suggest_recipes(
            db,
            ingredients=ingredients,
            calorie_target=target,
            meal_type=request.meal_type,
            count=request.count,
            dietary_preferences=current_user.dietary_preferences,
            language=request.language,
            avoid_titles=avoid_titles,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    recipes = [RecipeOut.model_validate(r) for r in payload.get("recipes", [])]
    return RecipeSuggestionResponse(recipes=recipes, source=source)


@router.post("/variant", response_model=RecipeSuggestionResponse)
async def variant(
    request: RecipeVariantRequest,
    current_user: CurrentUser,
    db: Db,
) -> RecipeSuggestionResponse:
    recipe_dict = request.recipe.model_dump()

    try:
        await check_and_consume_quota(current_user)
        payload, source = await generate_variant(
            db,
            recipe_dict=recipe_dict,
            variation=request.variation,
            language=request.language,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    recipe = RecipeOut.model_validate(payload)
    return RecipeSuggestionResponse(recipes=[recipe], source=source)


@router.get("/llm-test")
async def llm_test(
    x_admin_code: Annotated[str | None, Header(alias="X-Admin-Code")] = None,
):
    from app.core.config import settings
    if x_admin_code != settings.ADMIN_CODE:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not llm_service.is_configured:
        return {"error": "LLM not configured", "model": llm_service.model, "base_url": llm_service.base_url}
    try:
        raw = await llm_service.complete(
            "You are a helpful assistant. Return ONLY valid JSON.",
            'Return a JSON object with key "message" and value "hello". No other text.',
        )
        return {"model": llm_service.model, "raw_response": raw, "is_json": raw.strip().startswith("{")}
    except Exception as e:
        return {"error": str(e), "model": llm_service.model}


@router.post("/save", status_code=status.HTTP_201_CREATED, response_model=RecipeOut)
async def save_recipe(
    request: SaveRecipeRequest,
    current_user: CurrentUser,
    db: Db,
) -> RecipeOut:
    saved = SavedRecipe(
        user_id=current_user.id,
        title=request.title,
        summary=request.summary,
    )
    saved.set_payload(request.data.model_dump())
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return RecipeOut.model_validate(saved.get_payload())


@router.get("/saved", response_model=list[SavedRecipeOut])
async def list_saved(current_user: CurrentUser, db: Db) -> list[SavedRecipeOut]:
    result = await db.execute(
        select(SavedRecipe)
        .where(SavedRecipe.user_id == current_user.id)
        .order_by(SavedRecipe.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        SavedRecipeOut(
            id=row.id,
            title=row.title,
            summary=row.summary,
            created_at=row.created_at,
            recipe=RecipeOut.model_validate(row.get_payload()),
        )
        for row in rows
    ]


@router.delete("/saved/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved(
    saved_id: str,
    current_user: CurrentUser,
    db: Db,
) -> None:
    result = await db.execute(
        select(SavedRecipe).where(
            SavedRecipe.id == saved_id,
            SavedRecipe.user_id == current_user.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved recipe not found.",
        )
    await db.delete(row)
    await db.commit()
