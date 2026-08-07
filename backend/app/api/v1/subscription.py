from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.config import settings
from app.core.database import get_db
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import Plan
from app.schemas.subscription import (
    CheckoutResponse,
    PlanOut,
    SubscriptionOut,
)
from app.services import stripe_service

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
            id="pro",
            name="Pro",
            price_cents=600,
            features=[
                "Unlimited fridge items",
                "Unlimited AI recipes",
                "Meal-type filtering (breakfast/lunch/dinner)",
                "Priority generation & full nutrition breakdown",
            ],
        ),
    ]


@router.get("/me", response_model=SubscriptionOut)
async def get_my_subscription(current_user: CurrentUser, db: Db) -> SubscriptionOut:
    from sqlalchemy import select

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
async def create_checkout(current_user: CurrentUser) -> CheckoutResponse:
    try:
        url = await stripe_service.create_checkout_session(
            current_user,
            success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded=1",
            cancel_url=f"{settings.FRONTEND_URL}/pricing",
        )
    except stripe_service.StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=CheckoutResponse)
async def billing_portal(current_user: CurrentUser) -> CheckoutResponse:
    try:
        url = await stripe_service.create_portal_session(
            current_user,
            return_url=f"{settings.FRONTEND_URL}/dashboard",
        )
    except stripe_service.StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return CheckoutResponse(url=url)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Db) -> dict:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.construct_webhook_event(payload, sig_header)
    except (stripe_service.StripeNotConfigured, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    from sqlalchemy import select

    event_type = event["type"]
    data = event.get("data", {}).get("object", {})

    if event_type in {"checkout.session.completed", "customer.subscription.created"}:
        user_id = data.get("metadata", {}).get("user_id") or data.get("client_reference_id")
        if user_id:
            await _sync_subscription(db, user_id, data.get("subscription"))

    elif event_type == "customer.subscription.updated":
        sub_id = data.get("id")
        if sub_id:
            await _sync_subscription(db, None, sub_id)

    elif event_type == "customer.subscription.deleted":
        sub_id = data.get("id")
        if sub_id:
            result = await db.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == sub_id)
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = SubscriptionStatus.CANCELED
                from app.models.user import User

                result2 = await db.execute(select(User).where(User.id == sub.user_id))
                user = result2.scalar_one_or_none()
                if user:
                    user.plan = Plan.FREE
                await db.commit()

    return {"received": True}


async def _sync_subscription(db: AsyncSession, user_id: str | None, stripe_sub_id: str | None) -> None:
    from sqlalchemy import select

    if not stripe_sub_id:
        return
    try:
        stripe_sub = stripe_service.stripe.Subscription.retrieve(stripe_sub_id)
    except Exception:
        return

    if not user_id:
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            return
        user_id = existing.user_id

    status_map = {
        "trialing": SubscriptionStatus.TRIALING,
        "active": SubscriptionStatus.ACTIVE,
        "past_due": SubscriptionStatus.PAST_DUE,
        "canceled": SubscriptionStatus.CANCELED,
        "incomplete": SubscriptionStatus.INCOMPLETE,
    }
    from datetime import datetime

    from app.models.user import User

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        sub = Subscription(
            user_id=user_id,
            stripe_subscription_id=stripe_sub_id,
            stripe_price_id=stripe_sub.get("items", {}).get("data", [{}])[0].get("price", {}).get("id"),
            status=status_map.get(stripe_sub.get("status"), SubscriptionStatus.ACTIVE),
        )
        db.add(sub)
    else:
        sub.status = status_map.get(stripe_sub.get("status"), sub.status)
        sub.cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end"))

    period_end = stripe_sub.get("current_period_end")
    if period_end:
        sub.current_period_end = datetime.fromtimestamp(period_end)

    active = sub.status in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING}
    result2 = await db.execute(select(User).where(User.id == user_id))
    user = result2.scalar_one_or_none()
    if user:
        user.plan = Plan.PRO if active else Plan.FREE

    await db.commit()
