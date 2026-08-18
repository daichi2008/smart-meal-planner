from datetime import date

from fastapi import HTTPException, status

from app.models.user import Plan, User
from app.utils.cache import cache

FREE_DAILY_LIMIT = 5
WEEKLY_DAILY_LIMIT = 20


async def check_and_consume_quota(user: User) -> None:
    """Free users get 5 AI suggestions/day, weekly users 20/day, Pro is unlimited."""
    if user.plan == Plan.PRO or user.unlimited_suggestions:
        return

    limit = WEEKLY_DAILY_LIMIT if user.plan == Plan.WEEKLY else FREE_DAILY_LIMIT

    today = date.today().isoformat()
    key = f"quota:{user.id}:{today}"
    used = int(await cache.get(key) or 0)
    if used >= limit:
        plan_name = "الخطة الأسبوعية" if user.plan == Plan.WEEKLY else "Pro"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"وصلت للحد اليومي ({limit} اقتراحات). "
                f"رقِّ إلى {plan_name} للحصول على اقتراحات أكثر."
            ),
        )
    await cache.set(key, used + 1, ttl_seconds=24 * 3600)
