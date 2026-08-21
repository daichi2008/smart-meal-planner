import hmac
import logging
import traceback
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.models.meal import MealLog
from app.models.recipe import RecipeCache, SavedRecipe
from app.models.subscription import Subscription
from app.models.user import User

from app.services.llm import llm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

Db = Annotated[AsyncSession, Depends(get_db)]

ADMIN_CODE_HEADER = "X-Admin-Code"

limiter = Limiter(key_func=get_remote_address)


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
@limiter.limit("10/minute")
async def admin_overview(
    request: Request,
    db: Db,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
    debug: Annotated[int, Query()] = 0,
):
    _verify_admin_code(x_admin_code)

    warnings: list[str] = []

    async def count_rows(model) -> int:
        try:
            return (await db.execute(select(func.count()).select_from(model))).scalar_one()
        except Exception as exc:
            warnings.append(f"{model.__tablename__} count: {exc}")
            return 0

    total_users = await count_rows(User)
    total_subscriptions = await count_rows(Subscription)
    total_saved = await count_rows(SavedRecipe)
    total_meals = await count_rows(MealLog)

    recent_start = datetime.utcnow() - timedelta(days=7)
    try:
        recent_suggestions = (
            await db.execute(
                select(func.count()).select_from(RecipeCache).where(RecipeCache.created_at >= recent_start)
            )
        ).scalar_one()
    except Exception as exc:
        warnings.append(f"recent suggestions: {exc}")
        recent_suggestions = 0

    async def group_counts(model) -> dict[str, int]:
        try:
            result = await db.execute(
                select(model.user_id, func.count()).group_by(model.user_id)
            )
            return dict(result.all())
        except Exception as exc:
            warnings.append(f"{model.__tablename__} group counts: {exc}")
            return {}

    fridge_counts = await group_counts(FridgeItem)
    meal_counts = await group_counts(MealLog)
    saved_counts = await group_counts(SavedRecipe)

    try:
        users = (
            await db.execute(select(User).order_by(User.created_at.desc()))
        ).scalars().all()
    except Exception as exc:
        warnings.append(f"users: {exc}")
        users = []

    async def _table_columns(table: str) -> set[str]:
        if db.bind.dialect.name == "sqlite":
            rows = (await db.execute(text(f'PRAGMA table_info("{table}")'))).all()
            return {r[1] for r in rows}
        rows = (
            await db.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = :t"
                ),
                {"t": table},
            )
        ).all()
        return {r[0] for r in rows}

    try:
        avail = await _table_columns("subscriptions")
        wanted = [
            "id",
            "user_id",
            "amount_usd",
            "status",
            "current_period_end",
            "cancel_at_period_end",
            "created_at",
        ]
        use_cols = [c for c in wanted if c in avail]
        col_sql = ", ".join(f'"{c}"' for c in use_cols)
        sub_rows = (
            await db.execute(text(f'SELECT {col_sql} FROM subscriptions ORDER BY created_at DESC'))
        ).all()
    except Exception as exc:
        warnings.append(f"subscriptions: {exc}")
        sub_rows = []
        use_cols = []

    try:
        recent_meals = (
            await db.execute(select(MealLog).order_by(MealLog.created_at.desc()).limit(20))
        ).scalars().all()
    except Exception as exc:
        warnings.append(f"recent meals: {exc}")
        recent_meals = []

    try:
        recent_saves = (
            await db.execute(select(SavedRecipe).order_by(SavedRecipe.created_at.desc()).limit(20))
        ).scalars().all()
    except Exception as exc:
        warnings.append(f"recent saves: {exc}")
        recent_saves = []

    email_by_id = {u.id: u.email for u in users}
    active_statuses = {"active", "trialing", "past_due"}

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "warnings": warnings,
        "summary": {
            "total_users": total_users,
            "total_subscriptions": total_subscriptions,
            "active_subscriptions": sum(
                1
                for r in sub_rows
                if "status" in use_cols and str(r.status).lower() in active_statuses
            ),
            "total_saved_recipes": total_saved,
            "total_meals": total_meals,
            "recent_suggestions_7d": recent_suggestions,
        },
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan.value,
                "is_active": u.is_active,
                "unlimited_suggestions": getattr(u, "unlimited_suggestions", False),
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
                "amount_usd": r.amount_usd if "amount_usd" in use_cols else None,
                "status": str(r.status).lower() if "status" in use_cols else "unknown",
                "cancel_at_period_end": (
                    bool(r.cancel_at_period_end) if "cancel_at_period_end" in use_cols else False
                ),
                "current_period_end": (
                    _fmt_dt(r.current_period_end) if "current_period_end" in use_cols else None
                ),
                "created_at": _fmt_dt(r.created_at) if "created_at" in use_cols else None,
            }
            for r in sub_rows
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


@router.post("/users/{user_id}/unlimited")
@limiter.limit("10/minute")
async def toggle_unlimited(
    request: Request,
    user_id: str,
    db: Db,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
):
    _verify_admin_code(x_admin_code)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    current = getattr(user, "unlimited_suggestions", False)
    user.unlimited_suggestions = not current
    await db.commit()
    return {
        "user_id": user_id,
        "email": user.email,
        "unlimited_suggestions": user.unlimited_suggestions,
    }


@router.get("/llm-test")
@limiter.limit("5/minute")
async def llm_test(
    request: Request,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
):
    _verify_admin_code(x_admin_code)
    if not llm_service.is_configured:
        return {"error": "LLM not configured", "model": llm_service.model}
    try:
        raw = await llm_service.complete(
            "You are a helpful assistant. Return ONLY valid JSON.",
            'Return a JSON object with key "message" and value "hello". No other text.',
        )
        return {"model": llm_service.model, "raw_response": raw, "is_json": raw.strip().startswith("{")}
    except Exception:
        return {"error": "LLM request failed", "model": llm_service.model}


@router.post("/nuke")
@limiter.limit("2/minute")
async def nuke_site(
    request: Request,
    db: Db,
    x_admin_code: Annotated[str | None, Header(alias=ADMIN_CODE_HEADER)] = None,
    confirm: Annotated[str | None, Header(alias="X-Nuke-Confirm")] = None,
):
    _verify_admin_code(x_admin_code)

    if confirm != "DESTROY_EVERYTHING":
        raise HTTPException(
            status_code=400,
            detail="Missing X-Nuke-Confirm: DESTROY_EVERYTHING header. This is a destructive operation.",
        )

    deleted = {}

    for model in [FridgeItem, MealLog, SavedRecipe, RecipeCache, Subscription]:
        try:
            count = (await db.execute(select(func.count()).select_from(model))).scalar_one()
            await db.execute(text(f"DELETE FROM {model.__tablename__}"))
            deleted[model.__tablename__] = count
        except Exception as exc:
            deleted[model.__tablename__] = f"error: {exc}"

    try:
        count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        await db.execute(text("DELETE FROM users"))
        deleted["users"] = count
    except Exception as exc:
        deleted["users"] = f"error: {exc}"

    await db.commit()

    logger.warning("NUKE executed — deleted: %s", deleted)

    return {
        "status": "nuked",
        "deleted": deleted,
        "timestamp": datetime.utcnow().isoformat(),
    }
