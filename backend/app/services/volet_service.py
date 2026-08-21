"""Volet payment gateway service for processing subscriptions."""

import hashlib
import hmac
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

VOLET_SCI_URL = "https://volet.app/checkout"


class VoletNotConfigured(Exception):
    pass


def _ensure_configured() -> None:
    missing = [
        name
        for name, value in {
            "VOLET_MERCHANT_ID": settings.VOLET_MERCHANT_ID,
            "VOLET_API_KEY": settings.VOLET_API_KEY,
            "VOLET_SECRET_KEY": settings.VOLET_SECRET_KEY,
        }.items()
        if not value
    ]
    if missing:
        raise VoletNotConfigured(
            "Volet payment gateway is not configured. Missing: " + ", ".join(missing)
        )


def format_amount(amount: float) -> str:
    """Format amount to 2 decimal places."""
    return f"{amount:.2f}"


def _hash_fields(*parts: str) -> str:
    """Generate SHA256 hash from fields."""
    return hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()


def build_checkout_fields(order_id: str, amount_usd: float, plan_id: str) -> dict[str, str]:
    """Build form fields for Volet checkout."""
    _ensure_configured()
    amount = format_amount(amount_usd)
    
    # Create signature from merchant_id, order_id, amount, and secret_key
    signature = _hash_fields(
        settings.VOLET_MERCHANT_ID,
        order_id,
        amount,
        plan_id,
        settings.VOLET_SECRET_KEY,
    )
    
    return {
        "merchant_id": settings.VOLET_MERCHANT_ID,
        "order_id": order_id,
        "amount": amount,
        "currency": "USD",
        "plan_id": plan_id,
        "signature": signature,
        "return_url": f"{settings.FRONTEND_URL}/dashboard?upgraded=1",
        "cancel_url": f"{settings.FRONTEND_URL}/pricing?payment=failed",
        "notify_url": f"{settings.BACKEND_URL}/api/v1/subscription/volet/webhook",
        "description": f"Smart Meal Planner {plan_id.capitalize()} Plan",
    }


def verify_webhook_payload(data: dict[str, Any]) -> bool:
    """Verify the signature of a Volet webhook notification."""
    _ensure_configured()
    
    required = ["order_id", "amount", "status", "signature"]
    if any(key not in data for key in required):
        logger.warning("Volet webhook missing required fields")
        return False
    
    # Reconstruct the signature
    expected_signature = _hash_fields(
        str(data["order_id"]),
        str(data["amount"]),
        str(data["status"]),
        settings.VOLET_SECRET_KEY,
    )
    
    return hmac.compare_digest(expected_signature, str(data["signature"]))
