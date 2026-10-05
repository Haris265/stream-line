from __future__ import annotations

from rest_framework import serializers

from .models import LocationPing, Shift
from .utils import km_to_miles


class LocationPingSerializer(serializers.ModelSerializer):
    client_uuid = serializers.UUIDField(required=False)

    class Meta:
        model = LocationPing
        fields = (
            "id",
            "latitude",
            "longitude",
            "accuracy",
            "speed",
            "recorded_at",
            "client_uuid",
        )
        read_only_fields = ("id",)


class ShiftSerializer(serializers.ModelSerializer):
    total_miles = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    live_hours = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Shift
        fields = (
            "id",
            "user",
            "user_email",
            "clock_in",
            "clock_out",
            "total_hours",
            "total_distance_km",
            "total_miles",
            "live_hours",
            "is_open",
            "is_on_break",
            "break_started_at",
            "total_break_minutes",
            "client_uuid",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_total_miles(self, obj: Shift) -> float:
        return round(km_to_miles(obj.total_distance_km), 3)

    def get_live_hours(self, obj: Shift) -> float | None:
        return round(obj.worked_hours(), 4)


class ClockInSerializer(serializers.Serializer):
    client_uuid = serializers.UUIDField(required=False)
    clock_in = serializers.DateTimeField(required=False)


class ClockOutSerializer(serializers.Serializer):
    clock_out = serializers.DateTimeField(required=False)


class PingBatchSerializer(serializers.Serializer):
    pings = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_pings(self, value):
        cleaned = []
        for item in value:
            ser = LocationPingSerializer(data=item)
            ser.is_valid(raise_exception=True)
            cleaned.append(ser.validated_data)
        return cleaned


class SyncBatchSerializer(serializers.Serializer):
    clock_ins = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    clock_outs = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    pings = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
