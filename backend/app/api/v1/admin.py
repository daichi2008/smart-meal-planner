import hmac
import logging
import traceback
from collections import Counter
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.models.meal import MealLog
from app.models.recipe import RecipeCache, SavedRecipe
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)

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


def _fmt_dt(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


@router.get("/overview", response_model=None)
async def admin_overview(
    db: Db,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
    debug: Annotated[int, Query()] = 0,
):
    _verify_admin_code(x_admin_code)

    try:
        total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        total_subscriptions = (
            await db.execute(select(func.count()).select_from(Subscription))
        ).scalar_one()
        total_saved = (await db.execute(select(func.count()).select_from(SavedRecipe))).scalar_one()
        total_meals = (await db.execute(select(func.count()).select_from(MealLog))).scalar_one()

        recent_start = datetime.utcnow() - timedelta(days=7)
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
                text(
                    "SELECT id, user_id, amount_usd, status, current_period_end, "
                    "cancel_at_period_end, created_at FROM subscriptions "
                    "ORDER BY created_at DESC"
                )
            )
        ).all()

        recent_meals = (
            await db.execute(select(MealLog).order_by(MealLog.created_at.desc()).limit(20))
        ).scalars().all()

        recent_saves = (
            await db.execute(select(SavedRecipe).order_by(SavedRecipe.created_at.desc()).limit(20))
        ).scalars().all()
    except Exception as exc:
        logger.exception("admin overview failed")
        if debug:
            return JSONResponse(
                status_code=500,
                content={"error": f"{type(exc).__name__}: {exc}", "traceback": traceback.format_exc()},
            )
        raise

    email_by_id = {u.id: u.email for u in users}

    active_statuses = {"active", "trialing", "past_due"}

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "total_users": total_users,
            "total_subscriptions": total_subscriptions,
            "active_subscriptions": sum(1 for r in subscription_rows if str(r.status).lower() in active_statuses),
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
                "email": email_by_id.get(r.user_id, "?"),
                "amount_usd": r.amount_usd,
                "status": str(r.status).lower(),
                "cancel_at_period_end": bool(r.cancel_at_period_end),
                "current_period_end": _fmt_dt(r.current_period_end),
                "created_at": _fmt_dt(r.created_at),
            }
            for r in subscription_rows
        ],
        "recent_meals": [
            {
                "email": email_by_id.get(m.user_id, "?"),
                "title": m.title,
                "meal_type": m.meal_type,
                "calories": m.calories,
                "eaten_on": m.eaten_on.isoformat(),
                "created_at": m.created_at.isoformat(),
            }
            for m in recent_meals
        ],
        "recent_saves": [
            {
                "email": email_by_id.get(s.user_id, "?"),
                "title": s.title,
                "created_at": s.created_at.isoformat(),
            }
            for s in recent_saves
        ],
    }
