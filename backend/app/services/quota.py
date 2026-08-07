from datetime import date

from fastapi import HTTPException, status

from app.models.user import Plan, User
from app.utils.cache import cache

FREE_DAILY_LIMIT = 5


async def check_and_consume_quota(user: User) -> None:
    """Free users get a limited number of AI suggestions per day."""
    if user.plan == Plan.PRO:
        return

    today = date.today().isoformat()
    key = f"quota:{user.id}:{today}"
    used = int(await cache.get(key) or 0)
    if used >= FREE_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"وصلت للحد اليومي المجاني ({FREE_DAILY_LIMIT} اقتراحات). "
                "رقِّ إلى Pro للحصول على اقتراحات غير محدودة."
            ),
        )
    await cache.set(key, used + 1, ttl_seconds=24 * 3600)
