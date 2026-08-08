from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import Plan, User


async def maybe_expire_subscription(db: AsyncSession, user: User) -> None:
    """Downgrade paid users whose paid period has ended (lazy expiration)."""
    if user.plan not in {Plan.PRO, Plan.WEEKLY}:
        return
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalars().first()
    if sub and sub.current_period_end and sub.current_period_end < datetime.utcnow():
        sub.status = SubscriptionStatus.CANCELED
        sub.cancel_at_period_end = True
        user.plan = Plan.FREE
        await db.commit()
