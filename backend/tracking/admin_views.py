from __future__ import annotations

import csv
from datetime import datetime, time
from io import StringIO

from django.contrib.auth import get_user_model
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LocationPing, Shift
from .utils import km_to_miles

User = get_user_model()


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )


class LiveStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        open_shifts = (
            Shift.objects.filter(clock_out__isnull=True)
            .select_related("user")
            .order_by("clock_in")
        )
        payload = []
        for shift in open_shifts:
            last_ping = (
                LocationPing.objects.filter(shift=shift)
                .order_by("-recorded_at")
                .first()
            )
            live_hours = shift.worked_hours()
            payload.append(
                {
                    "user_id": shift.user_id,
                    "email": shift.user.email,
                    "first_name": shift.user.first_name,
                    "last_name": shift.user.last_name,
                    "shift_id": shift.id,
                    "clock_in": shift.clock_in,
                    "is_on_break": shift.is_on_break,
                    "live_hours": round(live_hours, 4),
                    "total_distance_km": float(shift.total_distance_km),
                    "total_miles": round(km_to_miles(shift.total_distance_km), 3),
                    "last_location": (
                        {
                            "latitude": float(last_ping.latitude),
                            "longitude": float(last_ping.longitude),
                            "recorded_at": last_ping.recorded_at,
                        }
                        if last_ping
                        else None
                    ),
                }
            )
        return Response(payload)


class EmployeeListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.filter(role=User.Role.EMPLOYEE).order_by("email")
        return Response(
            [
                {
                    "id": u.id,
                    "email": u.email,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "phone": u.phone,
                    "is_active": u.is_active,
                }
                for u in users
            ]
        )


class ExportCsvView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        qs = Shift.objects.select_related("user").order_by("clock_in")

        if start:
            start_date = parse_date(start)
            if not start_date:
                return Response(
                    {"detail": "Invalid start date (YYYY-MM-DD)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
            qs = qs.filter(clock_in__gte=start_dt)

        if end:
            end_date = parse_date(end)
            if not end_date:
                return Response(
                    {"detail": "Invalid end date (YYYY-MM-DD)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            end_dt = timezone.make_aware(datetime.combine(end_date, time.max))
            qs = qs.filter(clock_in__lte=end_dt)

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "email",
                "shift_id",
                "clock_in",
                "clock_out",
                "total_hours",
                "total_distance_km",
                "total_miles",
            ]
        )
        for shift in qs:
            writer.writerow(
                [
                    shift.user.email,
                    shift.id,
                    shift.clock_in.isoformat(),
                    shift.clock_out.isoformat() if shift.clock_out else "",
                    shift.total_hours if shift.total_hours is not None else "",
                    shift.total_distance_km,
                    round(km_to_miles(shift.total_distance_km), 3),
                ]
            )

        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="timesheets.csv"'
        return response
