import asyncio
import json
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings


class Cache:
    """Abstraction over Redis with an in-memory fallback for local development."""

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None
        self._memory: dict[str, tuple[float, str]] = {}
        self._lock = asyncio.Lock()
        self._using_redis = False

    async def connect(self) -> None:
        if settings.REDIS_URL:
            try:
                self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                await self._redis.ping()
                self._using_redis = True
            except Exception:
                self._redis = None
                self._using_redis = False

    async def get(self, key: str) -> Optional[Any]:
        if self._using_redis and self._redis:
            raw = await self._redis.get(key)
            return json.loads(raw) if raw else None
        entry = self._memory.get(key)
        if not entry:
            return None
        return json.loads(entry[1])

    async def set(self, key: str, value: Any, ttl_seconds: int = 86400) -> None:
        payload = json.dumps(value, ensure_ascii=False)
        if self._using_redis and self._redis:
            await self._redis.set(key, payload, ex=ttl_seconds)
            return
        async with self._lock:
            self._memory[key] = (ttl_seconds, payload)

    async def delete(self, key: str) -> None:
        if self._using_redis and self._redis:
            await self._redis.delete(key)
            return
        self._memory.pop(key, None)

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()


cache = Cache()
