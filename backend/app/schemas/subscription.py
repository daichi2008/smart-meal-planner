from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PlanOut(BaseModel):
    id: str
    name: str
    price_cents: int
    features: list[str]


class CheckoutResponse(BaseModel):
    action_url: str
    fields: dict[str, str]


class SubscriptionOut(BaseModel):
    plan: str
    is_pro: bool
    status: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
