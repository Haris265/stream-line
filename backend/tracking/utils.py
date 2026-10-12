from __future__ import annotations

import math
from decimal import Decimal
from typing import Iterable, Sequence

from .models import LocationPing, Shift

KM_TO_MILES = Decimal("0.621371")
EARTH_RADIUS_KM = 6371.0

MAX_ACCURACY_M = 20.0
MIN_SEGMENT_M = 10.0
MAX_SPEED_MPS = 50.0
# Walking/stationary: only count distance at or above this (~8 km/h).
MIN_DRIVING_SPEED_MPS = 2.2
NULL_ISLAND_EPS = 0.0001


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two WGS84 points in kilometers."""
    rlat1, rlon1, rlat2, rlon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))


def is_valid_coordinate(lat: float, lon: float) -> bool:
    if not math.isfinite(lat) or not math.isfinite(lon):
        return False
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        return False
    if abs(lat) < NULL_ISLAND_EPS and abs(lon) < NULL_ISLAND_EPS:
        return False
    return True


def is_accurate_enough(accuracy: float | None) -> bool:
    if accuracy is None:
        return True
    try:
        return float(accuracy) <= MAX_ACCURACY_M
    except (TypeError, ValueError):
        return True


def is_usable_ping(ping: LocationPing) -> bool:
    lat = float(ping.latitude)
    lon = float(ping.longitude)
    return is_valid_coordinate(lat, lon) and is_accurate_enough(ping.accuracy)


def distance_from_pings(pings: Sequence[LocationPing] | Iterable[LocationPing]) -> Decimal:
    """
    Sum filtered segments: skip (0,0)/invalid/poor accuracy, seed first good
    ping with 0 distance, then add only moves >= 10m at driving speed
    (>= MIN_DRIVING_SPEED_MPS when device speed is known) and <= 50 m/s.
    """
    points = list(pings)
    if not points:
        return Decimal("0")

    total = 0.0
    last: LocationPing | None = None

    for curr in points:
        if not is_usable_ping(curr):
            continue

        if last is None:
            last = curr
            continue

        lat1, lon1 = float(last.latitude), float(last.longitude)
        lat2, lon2 = float(curr.latitude), float(curr.longitude)
        km = haversine_km(lat1, lon1, lat2, lon2)
        meters = km * 1000.0

        if meters < MIN_SEGMENT_M:
            last = curr
            continue

        # Device GPS speed (m/s). None / negative = unknown — do not block.
        speed = curr.speed
        if speed is not None:
            try:
                speed_f = float(speed)
            except (TypeError, ValueError):
                speed_f = None
            if (
                speed_f is not None
                and math.isfinite(speed_f)
                and speed_f >= 0
                and speed_f < MIN_DRIVING_SPEED_MPS
            ):
                last = curr
                continue

        dt = (curr.recorded_at - last.recorded_at).total_seconds()
        if dt < 0:
            continue
        if dt == 0:
            # Same timestamp with real displacement → ignore teleport.
            continue
        if meters / dt > MAX_SPEED_MPS:
            # Keep previous good point; do not advance to the teleport.
            continue

        total += km
        last = curr

    return Decimal(str(round(total, 4)))


def recompute_shift_distance(shift: Shift) -> Decimal:
    km = distance_from_pings(shift.pings.order_by("recorded_at"))
    shift.total_distance_km = km
    shift.save(update_fields=["total_distance_km", "updated_at"])
    return km


def km_to_miles(km: Decimal | float | None) -> float:
    if km is None:
        return 0.0
    return float(Decimal(str(km)) * KM_TO_MILES)
