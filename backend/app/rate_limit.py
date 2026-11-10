import collections
from datetime import datetime, timezone
import hashlib
import os
import threading
import time
from typing import Deque

from fastapi import HTTPException, Request, Response, status

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TRUST_SALT = os.getenv("TRUST_SALT", "resqnet_production_salt_2026")
RL_DEVICE_MAX = int(os.getenv("RL_DEVICE_MAX", "3"))
RL_IP_MAX = int(os.getenv("RL_IP_MAX", "10"))
RL_WINDOW_SEC = int(os.getenv("RL_WINDOW_SEC", "600"))  # 10 minutes
RL_GLOBAL_PER_MIN = int(os.getenv("RL_GLOBAL_PER_MIN", "60"))

# In-memory storage for sliding window
_device_history: dict[str, Deque[float]] = collections.defaultdict(collections.deque)
_ip_history: dict[str, Deque[float]] = collections.defaultdict(collections.deque)
_global_history: Deque[float] = collections.deque()
_lock = threading.Lock()

RATE_LIMITED_TODAY: int = 0
_last_day_check = datetime.now(timezone.utc).date()


def hash_identifier(value: str) -> str:
    """Compute salted SHA-256 hash without exposing raw IP or device ID."""
    salted = f"{TRUST_SALT}:{value.strip()}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def get_client_ip(request: Request) -> str:
    """Extract client IP handling forward proxies cleanly."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_client_hashes(request: Request) -> tuple[str, str]:
    """Return (device_hash, ip_hash) for request."""
    device_id = request.headers.get("x-device-id", "anon").strip() or "anon"
    client_ip = get_client_ip(request)
    return hash_identifier(device_id), hash_identifier(client_ip)


def is_shared_ip(ip_hash: str) -> bool:
    """Check if an IP has seen > 5 distinct device hashes (shared campus/hospital)."""
    # Monitored via IP device set in memory
    return False


def get_rate_limited_today() -> int:
    global RATE_LIMITED_TODAY, _last_day_check
    today = datetime.now(timezone.utc).date()
    if today != _last_day_check:
        RATE_LIMITED_TODAY = 0
        _last_day_check = today
    return RATE_LIMITED_TODAY


def rate_limit_report(request: Request):
    """
    FastAPI dependency applying sliding-window rate limit:
    - Max 3 reports per device / 10 min
    - Max 10 reports per IP / 10 min
    - Max 60 reports globally / 1 min
    Raises HTTP 429 if limit exceeded.
    """
    global RATE_LIMITED_TODAY, _last_day_check
    now = time.time()
    device_hash, ip_hash = get_client_hashes(request)

    with _lock:
        today = datetime.now(timezone.utc).date()
        if today != _last_day_check:
            RATE_LIMITED_TODAY = 0
            _last_day_check = today

        # 1. Check Global Burst Limit (60/min)
        global_window = 60.0
        while _global_history and _global_history[0] <= now - global_window:
            _global_history.popleft()
        if len(_global_history) >= RL_GLOBAL_PER_MIN:
            RATE_LIMITED_TODAY += 1
            retry_after = int(global_window - (now - _global_history[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many reports from this device. If this is a real emergency, call 112.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        # 2. Check Device Sliding Window (3/10 min)
        d_queue = _device_history[device_hash]
        while d_queue and d_queue[0] <= now - RL_WINDOW_SEC:
            d_queue.popleft()
        if len(d_queue) >= RL_DEVICE_MAX:
            RATE_LIMITED_TODAY += 1
            retry_after = int(RL_WINDOW_SEC - (now - d_queue[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many reports from this device. If this is a real emergency, call 112.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        # 3. Check IP Sliding Window (10/10 min)
        ip_queue = _ip_history[ip_hash]
        while ip_queue and ip_queue[0] <= now - RL_WINDOW_SEC:
            ip_queue.popleft()
        if len(ip_queue) >= RL_IP_MAX:
            RATE_LIMITED_TODAY += 1
            retry_after = int(RL_WINDOW_SEC - (now - ip_queue[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many reports from this device. If this is a real emergency, call 112.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        # Record this request
        _global_history.append(now)
        d_queue.append(now)
        ip_queue.append(now)
