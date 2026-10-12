import asyncio
import time
from collections import deque


class InMemoryRateLimiter:
    """Sliding-window limiter kept in process memory.

    State is per process and resets on restart, which is acceptable for this single-instance
    deployment. Use a shared store (e.g. Redis) if the API is ever scaled horizontally.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window_seconds: float) -> bool:
        if window_seconds <= 0:
            return True
        now = time.monotonic()
        async with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        self._hits.clear()


password_reset_limiter = InMemoryRateLimiter()
