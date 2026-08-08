import logging
from datetime import datetime, timedelta
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import Plan, User
from app.schemas.subscription import (
    CheckoutResponse,
    PlanOut,
    SubscriptionOut,
)
from app.services import advcash_service, volet_service
from app.services.subscription_service import maybe_expire_subscription

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscription", tags=["subscription"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/plans", response_model=list[PlanOut])
async def list_plans() -> list[PlanOut]:
    return [
        PlanOut(
            id="free",
            name="Free",
            price_cents=0,
            features=[
                "Up to 20 fridge items",
                "5 AI recipe suggestions / day",
                "Basic calorie targets",
            ],
        ),
        PlanOut(
            id="weekly",
            name="Weekly",
            price_cents=int(round(settings.VOLET_WEEKLY_PRICE_USD * 100)),
            features=[
                "Unlimited fridge items",
                "20 AI recipe suggestions / day",
                "Meal-type filtering",
                "Nutrition breakdown",
            ],
        ),
        PlanOut(
            id="pro",
            name="Monthly Pro",
            price_cents=int(round(settings.VOLET_MONTHLY_PRICE_USD * 100)),
            features=[
                "Unlimited fridge items",
                "Unlimited AI recipes",
                "Meal-type filtering (breakfast/lunch/dinner)",
                "Priority generation & full nutrition breakdown",
                "Custom meal preferences",
            ],
        ),
    ]


@router.get("/me", response_model=SubscriptionOut)
async def get_my_subscription(current_user: CurrentUser, db: Db) -> SubscriptionOut:
    await maybe_expire_subscription(db, current_user)
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalars().first()
    return SubscriptionOut(
        plan=current_user.plan.value,
        is_pro=current_user.plan == Plan.PRO,
        status=sub.status.value if sub else None,
        current_period_end=sub.current_period_end if sub else None,
        cancel_at_period_end=sub.cancel_at_period_end if sub else False,
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    current_user: CurrentUser,
    plan_id: str = Query(...),
    provider: str = Query(default="volet", description="Payment provider: volet or advcash"),
    db: Db,
) -> CheckoutResponse:
    """Create a checkout session for the specified plan and payment provider."""
    if plan_id not in {"weekly", "pro"}:
        raise HTTPException(status_code=400, detail="Invalid plan_id")
    
    if provider not in {"volet", "advcash"}:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    order_id = f"smp-{uuid4().hex}"
    db.add(
        Subscription(
            user_id=current_user.id,
            provider_order_id=order_id,
            status=SubscriptionStatus.INCOMPLETE,
        )
    )
    await db.commit()
    
    try:
        if provider == "volet":
            amount = (
                settings.VOLET_WEEKLY_PRICE_USD
                if plan_id == "weekly"
                else settings.VOLET_MONTHLY_PRICE_USD
            )
            fields = volet_service.build_checkout_fields(order_id, amount, plan_id)
            return CheckoutResponse(action_url=volet_service.VOLET_SCI_URL, fields=fields)
        else:  # advcash
            fields = advcash_service.build_checkout_fields(order_id)
            return CheckoutResponse(action_url=advcash_service.SCI_URL, fields=fields)
    except (volet_service.VoletNotConfigured, advcash_service.AdvCashNotConfigured) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/status")
async def advcash_status_callback(request: Request, db: Db) -> Response:
    """Server-to-server IPN from AdvCash (ac_status_url)."""
    form = dict(await request.form())
    logger.info(
        "AdvCash IPN received: %s",
        {k: v for k, v in form.items() if k not in {"ac_hash"}},
    )

    if not advcash_service.verify_status_payload(form):
        return Response(content="verification failed", status_code=status.HTTP_400_BAD_REQUEST)

    order_id = form.get("ac_order_id")
    if not order_id:
        return Response(content="missing order id", status_code=status.HTTP_400_BAD_REQUEST)

    result = await db.execute(
        select(Subscription).where(Subscription.provider_order_id == order_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return Response(content="unknown order", status_code=status.HTTP_404_NOT_FOUND)

    ac_status = str(form.get("ac_status") or "").upper()
    if ac_status == "SUCCESS":
        await _activate_subscription(db, sub, form)
    elif ac_status in {"FAIL", "CANCELED"}:
        sub.status = SubscriptionStatus.CANCELED
        await db.commit()

    return Response(content="OK", media_type="text/plain")


async def _activate_subscription(
    db: AsyncSession, sub: Subscription, form: dict
) -> None:
    transfer_id = str(form.get("ac_transfer") or "")
    if sub.status == SubscriptionStatus.ACTIVE and sub.provider_transfer_id == transfer_id:
        return  # duplicate notification

    try:
        paid = float(form.get("ac_amount"))
    except (TypeError, ValueError):
        paid = 0.0
    if paid < settings.ADVCASH_PLAN_PRICE_USD - 0.01:
        logger.warning("AdvCash payment amount too low: %s", paid)
        return

    sub.provider_transfer_id = transfer_id
    sub.amount_usd = paid
    sub.status = SubscriptionStatus.ACTIVE
    sub.cancel_at_period_end = False
    sub.current_period_end = datetime.utcnow() + timedelta(days=settings.ADVCASH_SUBSCRIPTION_DAYS)

    result = await db.execute(select(User).where(User.id == sub.user_id))
    user = result.scalar_one_or_none()
    if user:
        user.plan = Plan.PRO

    await db.commit()
    logger.info("Activated Pro subscription for user %s (order %s)", sub.user_id, sub.provider_order_id)


@router.post("/volet/webhook")
async def volet_webhook(request: Request, db: Db) -> Response:
    """Webhook from Volet payment gateway."""
    form = dict(await request.form())
    logger.info(
        "Volet webhook received: %s",
        {k: v for k, v in form.items() if k not in {"signature"}},
    )

    if not volet_service.verify_webhook_payload(form):
        return Response(content="signature verification failed", status_code=status.HTTP_400_BAD_REQUEST)

    order_id = form.get("order_id")
    if not order_id:
        return Response(content="missing order_id", status_code=status.HTTP_400_BAD_REQUEST)

    result = await db.execute(
        select(Subscription).where(Subscription.provider_order_id == order_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return Response(content="unknown order", status_code=status.HTTP_404_NOT_FOUND)

    volet_status = str(form.get("status", "")).lower()
    if volet_status == "completed":
        await _activate_volet_subscription(db, sub, form)
    elif volet_status in {"failed", "cancelled"}:
        sub.status = SubscriptionStatus.CANCELED
        await db.commit()

    return Response(content="OK", media_type="text/plain")


async def _activate_volet_subscription(
    db: AsyncSession, sub: Subscription, form: dict
) -> None:
    """Activate subscription after successful Volet payment."""
    transaction_id = str(form.get("transaction_id", ""))
    plan_id = str(form.get("plan_id", "pro"))
    
    if sub.status == SubscriptionStatus.ACTIVE and sub.provider_transfer_id == transaction_id:
        return  # duplicate notification

    try:
        paid = float(form.get("amount", 0))
    except (TypeError, ValueError):
        paid = 0.0

    # Determine subscription plan and duration
    if plan_id == "weekly":
        min_amount = settings.VOLET_WEEKLY_PRICE_USD - 0.01
        subscription_days = settings.VOLET_WEEKLY_SUBSCRIPTION_DAYS
        user_plan = Plan.WEEKLY
    else:  # monthly/pro
        min_amount = settings.VOLET_MONTHLY_PRICE_USD - 0.01
        subscription_days = settings.VOLET_MONTHLY_SUBSCRIPTION_DAYS
        user_plan = Plan.PRO

    if paid < min_amount:
        logger.warning("Volet payment amount too low: %s for plan %s", paid, plan_id)
        return

    sub.provider_transfer_id = transaction_id
    sub.amount_usd = paid
    sub.status = SubscriptionStatus.ACTIVE
    sub.cancel_at_period_end = False
    sub.current_period_end = datetime.utcnow() + timedelta(days=subscription_days)

    result = await db.execute(select(User).where(User.id == sub.user_id))
    user = result.scalar_one_or_none()
    if user:
        user.plan = user_plan

    await db.commit()
    logger.info(
        "Activated %s subscription for user %s (order %s, payment provider: volet)",
        plan_id,
        sub.user_id,
        sub.provider_order_id,
    )

