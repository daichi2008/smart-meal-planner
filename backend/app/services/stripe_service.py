import logging
from typing import Optional

import stripe

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeNotConfigured(Exception):
    pass


def _ensure_configured() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise StripeNotConfigured("STRIPE_SECRET_KEY is not configured")


async def get_or_create_customer(user: User) -> str:
    _ensure_configured()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        name=user.full_name or user.email,
        metadata={"user_id": user.id},
    )
    return customer["id"]


async def create_checkout_session(user: User, success_url: str, cancel_url: str) -> str:
    _ensure_configured()
    if not settings.STRIPE_PRICE_PRO:
        raise StripeNotConfigured("STRIPE_PRICE_PRO is not configured")

    customer_id = await get_or_create_customer(user)
    checkout = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.STRIPE_PRICE_PRO, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        client_reference_id=user.id,
        metadata={"user_id": user.id},
    )
    return checkout["url"]


async def create_portal_session(user: User, return_url: str) -> str:
    _ensure_configured()
    customer_id = await get_or_create_customer(user)
    portal = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return portal["url"]


def construct_webhook_event(payload: bytes, sig_header: str):
    _ensure_configured()
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise StripeNotConfigured("STRIPE_WEBHOOK_SECRET is not configured")
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
