import logging
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.meal import MealLog
from app.schemas.meal import DailyCalories, MealLogCreate, MealLogOut, MealSummaryOut
from app.schemas.recipe import RecipeOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meals", tags=["meals"])

Db = Annotated[AsyncSession, Depends(get_db)]


def _recipe_from_payload(payload: dict | None) -> RecipeOut | None:
    if not payload:
        return None
    try:
        return RecipeOut.model_validate(payload)
    except Exception:
        return None


def _to_out(meal: MealLog) -> MealLogOut:
    return MealLogOut(
        id=meal.id,
        title=meal.title,
        meal_type=meal.meal_type,
        calories=meal.calories,
        eaten_on=meal.eaten_on,
        created_at=meal.created_at,
        recipe=_recipe_from_payload(meal.get_payload()),
    )


@router.post("", response_model=MealLogOut, status_code=status.HTTP_201_CREATED)
async def create_meal(payload: MealLogCreate, current_user: CurrentUser, db: Db) -> MealLogOut:
    calories = payload.calories
    if calories is None and payload.data:
        recipe = _recipe_from_payload(payload.data)
        if recipe:
            calories = recipe.calories_per_serving

    meal = MealLog(
        user_id=current_user.id,
        title=payload.title,
        meal_type=payload.meal_type,
        calories=calories,
        eaten_on=payload.eaten_on or date.today(),
    )
    meal.set_payload(payload.data)
    db.add(meal)
    await db.commit()
    await db.refresh(meal)
    return _to_out(meal)


@router.get("", response_model=list[MealLogOut])
async def list_meals(
    current_user: CurrentUser,
    db: Db,
    day: date | None = Query(default=None, alias="date"),
) -> list[MealLogOut]:
    on = day or date.today()
    result = await db.execute(
        select(MealLog)
        .where(MealLog.user_id == current_user.id, MealLog.eaten_on == on)
        .order_by(MealLog.created_at.desc())
    )
    return [_to_out(m) for m in result.scalars().all()]


@router.get("/summary", response_model=MealSummaryOut)
async def meal_summary(
    current_user: CurrentUser,
    db: Db,
    days: int = Query(default=7, ge=1, le=31),
) -> MealSummaryOut:
    start = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(MealLog.eaten_on, func.sum(MealLog.calories), func.count(MealLog.id))
        .where(
            MealLog.user_id == current_user.id,
            MealLog.eaten_on >= start,
            MealLog.calories.isnot(None),
        )
        .group_by(MealLog.eaten_on)
    )
    by_day: dict[date, tuple[float, int]] = {}
    for row in result.all():
        by_day[row[0]] = (float(row[1]), int(row[2]))

    day_rows: list[DailyCalories] = []
    totals: list[float] = []
    for i in range(days - 1, -1, -1):
        d = date.today() - timedelta(days=i)
        cal, meals = by_day.get(d, (0.0, 0))
        day_rows.append(DailyCalories(date=d, calories=cal, meals=meals))
        if meals:
            totals.append(cal)

    today_cal, today_meals = by_day.get(date.today(), (0.0, 0))
    target = current_user.calorie_target
    average = (sum(totals) / len(totals)) if totals else 0.0
    return MealSummaryOut(
        days=day_rows,
        average_calories=round(average, 1),
        target=target,
        consumed_today=today_cal,
        meals_today=today_meals,
        remaining_today=round(target - today_cal, 1) if target else None,
    )


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(meal_id: str, current_user: CurrentUser, db: Db) -> None:
    result = await db.execute(
        select(MealLog).where(MealLog.id == meal_id, MealLog.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found.")
    await db.delete(row)
    await db.commit()
