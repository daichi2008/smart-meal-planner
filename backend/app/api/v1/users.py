from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.models.meal import MealLog
from app.models.recipe import SavedRecipe
from app.schemas.auth import UserBase, UserStatsOut, UserUpdate
from app.utils.cache import cache

router = APIRouter(prefix="/users", tags=["users"])

Db = Annotated[AsyncSession, Depends(get_db)]


async def _count(db: AsyncSession, model, user_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(model).where(model.user_id == user_id)
    )
    return int(result.scalar_one())


async def _has_meals(db: AsyncSession, user_id: str, day: date) -> bool:
    result = await db.execute(
        select(func.count())
        .select_from(MealLog)
        .where(MealLog.user_id == user_id, MealLog.eaten_on == day)
    )
    return int(result.scalar_one()) > 0


@router.get("/me", response_model=UserBase)
async def get_me(current_user: CurrentUser) -> UserBase:
    return current_user


@router.patch("/me", response_model=UserBase)
async def update_me(payload: UserUpdate, current_user: CurrentUser, db: Db) -> UserBase:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me/stats", response_model=UserStatsOut)
async def my_stats(current_user: CurrentUser, db: Db) -> UserStatsOut:
    today = date.today()

    fridge_count = await _count(db, FridgeItem, current_user.id)
    saved_count = await _count(db, SavedRecipe, current_user.id)
    meals_total = await _count(db, MealLog, current_user.id)

    streak = 0
    cursor = today
    if not await _has_meals(db, current_user.id, cursor):
        cursor = today - timedelta(days=1)
    while await _has_meals(db, current_user.id, cursor):
        streak += 1
        cursor -= timedelta(days=1)

    used_today = int(await cache.get(f"quota:{current_user.id}:{today.isoformat()}") or 0)

    start = today - timedelta(days=6)
    total_cal = await db.execute(
        select(func.coalesce(func.sum(MealLog.calories), 0.0)).where(
            MealLog.user_id == current_user.id,
            MealLog.eaten_on >= start,
            MealLog.calories.isnot(None),
        )
    )
    total_cal = float(total_cal.scalar_one())
    meal_days = set(
        (
            await db.execute(
                select(MealLog.eaten_on).where(
                    MealLog.user_id == current_user.id,
                    MealLog.eaten_on >= start,
                )
            )
        )
        .scalars()
        .all()
    )
    weekly_avg = round(total_cal / len(meal_days), 1) if meal_days else 0.0

    return UserStatsOut(
        plan=current_user.plan.value,
        fridge_count=fridge_count,
        saved_count=saved_count,
        meals_logged_total=meals_total,
        streak_days=streak,
        suggestions_used_today=used_today,
        weekly_average_calories=weekly_avg,
    )
