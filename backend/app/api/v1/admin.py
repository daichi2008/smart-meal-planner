import hmac
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.models.meal import MealLog
from app.models.recipe import RecipeCache, SavedRecipe
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

Db = Annotated[AsyncSession, Depends(get_db)]

ADMIN_CODE_HEADER = "X-Admin-Code"


def _verify_admin_code(x_admin_code: str | None) -> None:
    expected = settings.ADMIN_CODE
    if not expected or not x_admin_code or not hmac.compare_digest(x_admin_code, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )


@router.get("/overview")
async def admin_overview(
    db: Db,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
) -> dict:
    _verify_admin_code(x_admin_code)

    recent_start = datetime.utcnow() - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_saved = (await db.execute(select(func.count()).select_from(SavedRecipe))).scalar_one()
    total_meals = (await db.execute(select(func.count()).select_from(MealLog))).scalar_one()
    total_subscriptions = (
        await db.execute(select(func.count()).select_from(Subscription))
    ).scalar_one()
    active_subscriptions = (
        await db.execute(
            select(func.count())
            .select_from(Subscription)
            .where(
                Subscription.status.in_(
                    [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE]
                )
            )
        )
    ).scalar_one()
    recent_suggestions = (
        await db.execute(
            select(func.count()).select_from(RecipeCache).where(RecipeCache.created_at >= recent_start)
        )
    ).scalar_one()

    fridge_counts = dict(
        (await db.execute(select(FridgeItem.user_id, func.count()).group_by(FridgeItem.user_id))).all()
    )
    meal_counts = dict(
        (await db.execute(select(MealLog.user_id, func.count()).group_by(MealLog.user_id))).all()
    )
    saved_counts = dict(
        (await db.execute(select(SavedRecipe.user_id, func.count()).group_by(SavedRecipe.user_id))).all()
    )

    users = (
        await db.execute(select(User).order_by(User.created_at.desc()))
    ).scalars().all()

    subscription_rows = (
        await db.execute(
            select(Subscription, User.email)
            .join(User, Subscription.user_id == User.id)
            .order_by(Subscription.created_at.desc())
        )
    ).all()

    recent_meals = (
        await db.execute(
            select(MealLog, User.email)
            .join(User, MealLog.user_id == User.id)
            .order_by(MealLog.created_at.desc())
            .limit(20)
        )
    ).all()

    recent_saves = (
        await db.execute(
            select(SavedRecipe, User.email)
            .join(User, SavedRecipe.user_id == User.id)
            .order_by(SavedRecipe.created_at.desc())
            .limit(20)
        )
    ).all()

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_users": total_users,
            "total_subscriptions": total_subscriptions,
            "active_subscriptions": active_subscriptions,
            "total_saved_recipes": total_saved,
            "total_meals": total_meals,
            "recent_suggestions_7d": recent_suggestions,
        },
        "users": [
            {
                "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan.value,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
                "fridge_count": fridge_counts.get(u.id, 0),
                "meals_count": meal_counts.get(u.id, 0),
                "saved_count": saved_counts.get(u.id, 0),
            }
            for u in users
        ],
        "subscriptions": [
            {
                "email": email,
                "amount_usd": sub.amount_usd,
                "status": sub.status.value,
                "cancel_at_period_end": sub.cancel_at_period_end,
                "current_period_end": (
                    sub.current_period_end.isoformat() if sub.current_period_end else None
                ),
                "created_at": sub.created_at.isoformat(),
            }
            for sub, email in subscription_rows
        ],
        "recent_meals": [
            {
                "email": email,
                "title": meal.title,
                "meal_type": meal.meal_type,
                "calories": meal.calories,
                "eaten_on": meal.eaten_on.isoformat(),
                "created_at": meal.created_at.isoformat(),
            }
            for meal, email in recent_meals
        ],
        "recent_saves": [
            {
                "email": email,
                "title": save.title,
                "created_at": save.created_at.isoformat(),
            }
            for save, email in recent_saves
        ],
    }
