from __future__ import annotations

import math
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Iterable, Sequence, TypedDict

from django.utils import timezone

from .models import LocationPing, Shift

KM_TO_MILES = Decimal("0.621371")
EARTH_RADIUS_KM = 6371.0

MAX_ACCURACY_M = 20.0
MIN_SEGMENT_M = 10.0
MAX_SPEED_MPS = 50.0
# Car/bike only: ignore walking/stationary below this (~5.4 km/h; slow bikes/traffic still count).
MIN_DRIVING_SPEED_MPS = 1.5
NULL_ISLAND_EPS = 0.0001

# Live activity detection (admin Team status).
ACTIVITY_GRACE_MINUTES = 5
ACTIVITY_STALE_GPS_MINUTES = 5
ACTIVITY_IDLE_MILES_THRESHOLD = 0.05

ACTIVITY_LABELS = {
    "on_break": "On break",
    "starting": "Starting",
    "no_gps": "No GPS",
    "not_driving": "Not driving",
    "driving": "Driving",
}


class ActivityStatusResult(TypedDict):
    activity_status: str
    activity_label: str
    minutes_since_last_ping: float | None
    last_speed_mps: float | None


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

        # Device GPS speed (m/s). Known walking/stationary → no miles.
        speed = curr.speed
        speed_f: float | None = None
        if speed is not None:
            try:
                speed_f = float(speed)
            except (TypeError, ValueError):
                speed_f = None
            if speed_f is not None and (
                not math.isfinite(speed_f) or speed_f < 0
            ):
                speed_f = None
        has_known_speed = speed_f is not None
        if has_known_speed and speed_f < MIN_DRIVING_SPEED_MPS:
            last = curr
            continue

        dt = (curr.recorded_at - last.recorded_at).total_seconds()
        if dt < 0:
            continue
        if dt == 0:
            # Same timestamp with real displacement → ignore teleport.
            continue
        implied_mps = meters / dt
        if implied_mps > MAX_SPEED_MPS:
            # Keep previous good point; do not advance to the teleport.
            continue
        # Unknown device speed: require car/bike pace from segment timing.
        if not has_known_speed and implied_mps < MIN_DRIVING_SPEED_MPS:
            last = curr
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


def _ping_speed_mps(ping: LocationPing | None) -> float | None:
    if ping is None or ping.speed is None:
        return None
    try:
        speed_f = float(ping.speed)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(speed_f) or speed_f < 0:
        return None
    return speed_f


def shift_activity_status(
    shift: Shift,
    last_ping: LocationPing | None = None,
    now: datetime | None = None,
) -> ActivityStatusResult:
    """
    Classify an open shift for admin live monitoring.

    Priority: on_break → starting (grace) → no_gps → driving → not_driving.
    """
    at = now or timezone.now()
    last_speed = _ping_speed_mps(last_ping)
    minutes_since: float | None = None
    if last_ping is not None:
        minutes_since = max(
            0.0, (at - last_ping.recorded_at).total_seconds() / 60.0
        )

    def result(status: str) -> ActivityStatusResult:
        return {
            "activity_status": status,
            "activity_label": ACTIVITY_LABELS[status],
            "minutes_since_last_ping": (
                round(minutes_since, 1) if minutes_since is not None else None
            ),
            "last_speed_mps": (
                round(last_speed, 2) if last_speed is not None else None
            ),
        }

    if shift.is_on_break:
        return result("on_break")

    minutes_since_clock_in = (at - shift.clock_in).total_seconds() / 60.0
    if minutes_since_clock_in < ACTIVITY_GRACE_MINUTES:
        return result("starting")

    stale_cutoff = timedelta(minutes=ACTIVITY_STALE_GPS_MINUTES)
    if last_ping is None or (at - last_ping.recorded_at) > stale_cutoff:
        return result("no_gps")

    miles = km_to_miles(shift.total_distance_km)
    if miles >= ACTIVITY_IDLE_MILES_THRESHOLD:
        return result("driving")
    if last_speed is not None and last_speed >= MIN_DRIVING_SPEED_MPS:
        return result("driving")

    return result("not_driving")
