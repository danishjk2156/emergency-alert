import math
import os
import threading
import time
from typing import Optional
import urllib.parse

import httpx

NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL", "contact@resqnet.dev")
USER_AGENT = f"ResQNet-Hackathon/1.0 ({NOMINATIM_EMAIL})"

# Nominatim rate limiting: at most 1 req/sec
_geo_lock = threading.Lock()
_last_request_time = 0.0

# In-memory cache for geocoding results
_reverse_cache: dict[tuple[float, float], str] = {}
_forward_cache: dict[str, tuple[float, float]] = {}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def _rate_limit_nominatim():
    """Ensure at least 1.0 second between consecutive Nominatim requests."""
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_request_time = time.time()


def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """Reverse geocode latitude and longitude into address using OpenStreetMap Nominatim."""
    key = (round(lat, 5), round(lon, 5))
    if key in _reverse_cache:
        return _reverse_cache[key]

    with _geo_lock:
        _rate_limit_nominatim()
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {"User-Agent": USER_AGENT}
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    display_name = data.get("display_name")
                    if display_name:
                        _reverse_cache[key] = display_name
                        return display_name
        except Exception:
            return None
    return None


def forward_geocode(query: str) -> Optional[tuple[float, float]]:
    """Forward geocode address text into (latitude, longitude) using Nominatim."""
    normalized_q = query.strip().lower()
    if normalized_q in _forward_cache:
        return _forward_cache[normalized_q]

    with _geo_lock:
        _rate_limit_nominatim()
        quoted_q = urllib.parse.quote(query)
        url = f"https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q={quoted_q}"
        headers = {"User-Agent": USER_AGENT}
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data and len(data) > 0:
                        lat = float(data[0]["lat"])
                        lon = float(data[0]["lon"])
                        coords = (lat, lon)
                        _forward_cache[normalized_q] = coords
                        return coords
        except Exception:
            return None
    return None


def calculate_location_mismatch(
    gps_lat: float,
    gps_lon: float,
    typed_location: str,
) -> Optional[float]:
    """Calculate mismatch distance in km between GPS coordinates and typed location text."""
    if not typed_location or len(typed_location.strip()) < 3:
        return None

    geo_coords = forward_geocode(typed_location)
    if not geo_coords:
        return None

    text_lat, text_lon = geo_coords
    return round(haversine_distance_km(gps_lat, gps_lon, text_lat, text_lon), 2)
