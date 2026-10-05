import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Shift(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shifts",
    )
    clock_in = models.DateTimeField()
    clock_out = models.DateTimeField(null=True, blank=True)
    total_hours = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )
    total_distance_km = models.DecimalField(
        max_digits=12, decimal_places=4, default=0
    )
    is_on_break = models.BooleanField(default=False)
    break_started_at = models.DateTimeField(null=True, blank=True)
    total_break_minutes = models.DecimalField(
        max_digits=10, decimal_places=2, default=0
    )
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-clock_in"]

    def __str__(self) -> str:
        status = "open" if self.clock_out is None else "closed"
        return f"Shift {self.id} ({self.user_id}) [{status}]"

    @property
    def is_open(self) -> bool:
        return self.clock_out is None

    def break_minutes_including_active(self, at=None) -> float:
        total = float(self.total_break_minutes or 0)
        if self.is_on_break and self.break_started_at:
            end = at or timezone.now()
            total += max(0.0, (end - self.break_started_at).total_seconds() / 60.0)
        return total

    def worked_hours(self, end=None) -> float:
        end_dt = end or self.clock_out or timezone.now()
        raw = (end_dt - self.clock_in).total_seconds() / 3600.0
        break_h = self.break_minutes_including_active(end_dt) / 60.0
        return max(0.0, raw - break_h)


class LocationPing(models.Model):
    shift = models.ForeignKey(
        Shift,
        on_delete=models.CASCADE,
        related_name="pings",
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True, help_text="m/s from device")
    recorded_at = models.DateTimeField()
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["recorded_at"]

    def __str__(self) -> str:
        return f"Ping {self.id} @ {self.recorded_at}"
