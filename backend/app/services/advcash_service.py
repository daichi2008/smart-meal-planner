import hashlib
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

SCI_URL = "https://wallet.advcash.com/sci/"


class AdvCashNotConfigured(Exception):
    pass


def _ensure_configured() -> None:
    missing = [
        name
        for name, value in {
            "ADVCASH_ACCOUNT_EMAIL": settings.ADVCASH_ACCOUNT_EMAIL,
            "ADVCASH_SCI_NAME": settings.ADVCASH_SCI_NAME,
            "ADVCASH_SCI_PASSWORD": settings.ADVCASH_SCI_PASSWORD,
        }.items()
        if not value
    ]
    if missing:
        raise AdvCashNotConfigured(
            "AdvCash (Volet) SCI is not configured. Missing: " + ", ".join(missing)
        )


def format_amount(amount: float) -> str:
    return f"{amount:.2f}"


def _hash_fields(*parts: str) -> str:
    return hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()


def build_checkout_fields(order_id: str) -> dict[str, str]:
    """Hidden fields for the SCI form posted to https://wallet.advcash.com/sci/."""
    _ensure_configured()
    amount = format_amount(settings.ADVCASH_PLAN_PRICE_USD)
    sign = _hash_fields(
        settings.ADVCASH_ACCOUNT_EMAIL,
        settings.ADVCASH_SCI_NAME,
        amount,
        settings.ADVCASH_CURRENCY,
        settings.ADVCASH_SCI_PASSWORD,
        order_id,
    )
    return {
        "ac_account_email": settings.ADVCASH_ACCOUNT_EMAIL,
        "ac_sci_name": settings.ADVCASH_SCI_NAME,
        "ac_amount": amount,
        "ac_currency": settings.ADVCASH_CURRENCY,
        "ac_order_id": order_id,
        "ac_sign": sign,
        "ac_success_url": f"{settings.FRONTEND_URL}/dashboard?upgraded=1",
        "ac_success_url_method": "POST",
        "ac_fail_url": f"{settings.FRONTEND_URL}/pricing?payment=failed",
        "ac_fail_url_method": "POST",
        "ac_status_url": f"{settings.BACKEND_URL}/api/v1/subscription/status",
        "ac_status_url_method": "POST",
        "ac_comments": f"Smart Meal Planner Pro ({settings.ADVCASH_SUBSCRIPTION_DAYS} days)",
    }


def verify_status_payload(data: dict[str, Any]) -> bool:
    """Verify the ac_hash of an AdvCash status notification (IPN)."""
    _ensure_configured()
    required = [
        "ac_transfer",
        "ac_start_date",
        "ac_sci_name",
        "ac_src_wallet",
        "ac_dest_wallet",
        "ac_order_id",
        "ac_amount",
        "ac_merchant_currency",
        "ac_hash",
    ]
    if any(key not in data for key in required):
        logger.warning("AdvCash IPN missing required fields")
        return False
    if data.get("ac_sci_name") != settings.ADVCASH_SCI_NAME:
        logger.warning("AdvCash IPN sci name mismatch")
        return False
    expected = _hash_fields(
        str(data["ac_transfer"]),
        str(data["ac_start_date"]),
        str(data["ac_sci_name"]),
        str(data["ac_src_wallet"]),
        str(data["ac_dest_wallet"]),
        str(data["ac_order_id"]),
        str(data["ac_amount"]),
        str(data["ac_merchant_currency"]),
        settings.ADVCASH_SCI_PASSWORD,
    )
    return expected == str(data["ac_hash"])
