from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LocationPing, Shift
from .serializers import (
    ClockInSerializer,
    ClockOutSerializer,
    PingBatchSerializer,
    ShiftSerializer,
    SyncBatchSerializer,
)
from .utils import recompute_shift_distance


class IsAuthenticated(permissions.IsAuthenticated):
    pass


def _parse_dt(value) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = parse_datetime(str(value))
        if dt is None:
            raise ValueError(f"Invalid datetime: {value}")
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _user_open_shift(user) -> Shift | None:
    return Shift.objects.filter(user=user, clock_out__isnull=True).first()


class ClockInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ClockInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        existing = _user_open_shift(request.user)
        if existing:
            return Response(
                {
                    "detail": "Already clocked in.",
                    "shift": ShiftSerializer(existing).data,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_uuid = data.get("client_uuid") or uuid4()
        existing_by_uuid = Shift.objects.filter(client_uuid=client_uuid).first()
        if existing_by_uuid:
            return Response(ShiftSerializer(existing_by_uuid).data, status=status.HTTP_200_OK)

        clock_in = data.get("clock_in") or timezone.now()
        shift = Shift.objects.create(
            user=request.user,
            clock_in=clock_in,
            client_uuid=client_uuid,
        )
        return Response(ShiftSerializer(shift).data, status=status.HTTP_201_CREATED)


class ClockOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = ClockOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shift = get_object_or_404(Shift, pk=pk, user=request.user)

        if shift.clock_out is not None:
            return Response(ShiftSerializer(shift).data)

        clock_out = serializer.validated_data.get("clock_out") or timezone.now()
        if clock_out < shift.clock_in:
            return Response(
                {"detail": "clock_out cannot be before clock_in"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shift.clock_out = clock_out
        if shift.is_on_break and shift.break_started_at:
            minutes = (clock_out - shift.break_started_at).total_seconds() / 60.0
            shift.total_break_minutes = Decimal(
                str(round(float(shift.total_break_minutes or 0) + max(0.0, minutes), 2))
            )
            shift.is_on_break = False
            shift.break_started_at = None
        hours = shift.worked_hours(clock_out)
        shift.total_hours = Decimal(str(round(hours, 4)))
        shift.save(
            update_fields=[
                "clock_out",
                "total_hours",
                "total_break_minutes",
                "is_on_break",
                "break_started_at",
                "updated_at",
            ]
        )
        recompute_shift_distance(shift)
        shift.refresh_from_db()
        return Response(ShiftSerializer(shift).data)


class CurrentShiftView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shift = _user_open_shift(request.user)
        if not shift:
            return Response({"shift": None})
        return Response({"shift": ShiftSerializer(shift).data})


class ShiftListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Shift.objects.select_related("user")
        user_id = request.query_params.get("user")
        if request.user.is_admin and user_id:
            qs = qs.filter(user_id=user_id)
        elif not request.user.is_admin:
            qs = qs.filter(user=request.user)
        else:
            # Admin without filter: all shifts
            pass

        qs = qs.order_by("-clock_in")[:100]
        return Response(ShiftSerializer(qs, many=True).data)


class PingBatchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        shift = get_object_or_404(Shift, pk=pk)
        if shift.user_id != request.user.id and not request.user.is_admin:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if shift.clock_out is not None:
            return Response(
                {"detail": "Cannot add pings to a closed shift."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PingBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created = 0
        with transaction.atomic():
            for item in serializer.validated_data["pings"]:
                client_uuid = item.get("client_uuid") or uuid4()
                _, was_created = LocationPing.objects.get_or_create(
                    client_uuid=client_uuid,
                    defaults={
                        "shift": shift,
                        "latitude": item["latitude"],
                        "longitude": item["longitude"],
                        "accuracy": item.get("accuracy"),
                        "speed": item.get("speed"),
                        "recorded_at": item["recorded_at"],
                    },
                )
                if was_created:
                    created += 1
            recompute_shift_distance(shift)

        shift.refresh_from_db()
        return Response(
            {"created": created, "shift": ShiftSerializer(shift).data},
            status=status.HTTP_201_CREATED,
        )


class SyncBatchView(APIView):
    """Offline-first idempotent sync for clock events and GPS pings."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SyncBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        results = {"shifts": [], "pings_created": 0, "clock_outs": []}

        with transaction.atomic():
            for item in data.get("clock_ins", []):
                client_uuid = item.get("client_uuid") or str(uuid4())
                existing = Shift.objects.filter(client_uuid=client_uuid).first()
                if existing:
                    results["shifts"].append(ShiftSerializer(existing).data)
                    continue
                open_shift = _user_open_shift(request.user)
                if open_shift:
                    results["shifts"].append(ShiftSerializer(open_shift).data)
                    continue
                clock_in = _parse_dt(item.get("clock_in") or timezone.now().isoformat())
                shift = Shift.objects.create(
                    user=request.user,
                    clock_in=clock_in,
                    client_uuid=client_uuid,
                )
                results["shifts"].append(ShiftSerializer(shift).data)

            for item in data.get("clock_outs", []):
                shift = None
                if item.get("client_uuid"):
                    shift = Shift.objects.filter(
                        client_uuid=item["client_uuid"], user=request.user
                    ).first()
                if shift is None and item.get("shift_id"):
                    shift = Shift.objects.filter(
                        pk=item["shift_id"], user=request.user
                    ).first()
                if shift is None:
                    shift = _user_open_shift(request.user)
                if shift is None or shift.clock_out is not None:
                    if shift:
                        results["clock_outs"].append(ShiftSerializer(shift).data)
                    continue
                clock_out = _parse_dt(item.get("clock_out") or timezone.now().isoformat())
                if clock_out < shift.clock_in:
                    continue
                shift.clock_out = clock_out
                hours = (clock_out - shift.clock_in).total_seconds() / 3600.0
                shift.total_hours = Decimal(str(round(hours, 4)))
                shift.save(update_fields=["clock_out", "total_hours", "updated_at"])
                recompute_shift_distance(shift)
                shift.refresh_from_db()
                results["clock_outs"].append(ShiftSerializer(shift).data)

            for item in data.get("pings", []):
                shift = None
                if item.get("shift_client_uuid"):
                    shift = Shift.objects.filter(
                        client_uuid=item["shift_client_uuid"], user=request.user
                    ).first()
                if shift is None and item.get("shift_id"):
                    shift = Shift.objects.filter(
                        pk=item["shift_id"], user=request.user
                    ).first()
                if shift is None:
                    shift = _user_open_shift(request.user)
                if shift is None:
                    continue

                client_uuid = item.get("client_uuid") or uuid4()
                recorded_at = _parse_dt(item["recorded_at"])
                _, was_created = LocationPing.objects.get_or_create(
                    client_uuid=client_uuid,
                    defaults={
                        "shift": shift,
                        "latitude": item["latitude"],
                        "longitude": item["longitude"],
                        "accuracy": item.get("accuracy"),
                        "speed": item.get("speed"),
                        "recorded_at": recorded_at,
                    },
                )
                if was_created:
                    results["pings_created"] += 1
                    if shift.is_open or True:
                        recompute_shift_distance(shift)

        return Response(results)


class BreakStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        shift = get_object_or_404(Shift, pk=pk, user=request.user)
        if shift.clock_out is not None:
            return Response(
                {"detail": "Cannot break on a closed shift."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if shift.is_on_break:
            return Response(ShiftSerializer(shift).data)
        shift.is_on_break = True
        shift.break_started_at = timezone.now()
        shift.save(update_fields=["is_on_break", "break_started_at", "updated_at"])
        return Response(ShiftSerializer(shift).data)


class BreakEndView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        shift = get_object_or_404(Shift, pk=pk, user=request.user)
        if not shift.is_on_break or not shift.break_started_at:
            return Response(ShiftSerializer(shift).data)
        now = timezone.now()
        minutes = (now - shift.break_started_at).total_seconds() / 60.0
        shift.total_break_minutes = Decimal(
            str(round(float(shift.total_break_minutes or 0) + max(0.0, minutes), 2))
        )
        shift.is_on_break = False
        shift.break_started_at = None
        shift.save(
            update_fields=[
                "total_break_minutes",
                "is_on_break",
                "break_started_at",
                "updated_at",
            ]
        )
        return Response(ShiftSerializer(shift).data)
