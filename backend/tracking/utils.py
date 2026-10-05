from __future__ import annotations

import math
from decimal import Decimal
from typing import Iterable, Sequence

from .models import LocationPing, Shift

KM_TO_MILES = Decimal("0.621371")
EARTH_RADIUS_KM = 6371.0


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


def distance_from_pings(pings: Sequence[LocationPing] | Iterable[LocationPing]) -> Decimal:
    points = list(pings)
    if len(points) < 2:
        return Decimal("0")

    total = 0.0
    for prev, curr in zip(points, points[1:]):
        total += haversine_km(
            float(prev.latitude),
            float(prev.longitude),
            float(curr.latitude),
            float(curr.longitude),
        )
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
