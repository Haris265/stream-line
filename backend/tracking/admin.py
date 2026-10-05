from django.contrib import admin

from .models import LocationPing, Shift


class LocationPingInline(admin.TabularInline):
    model = LocationPing
    extra = 0
    readonly_fields = (
        "latitude",
        "longitude",
        "accuracy",
        "speed",
        "recorded_at",
        "client_uuid",
    )


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "clock_in",
        "clock_out",
        "total_hours",
        "total_distance_km",
    )
    list_filter = ("clock_out",)
    search_fields = ("user__email", "client_uuid")
    inlines = [LocationPingInline]


@admin.register(LocationPing)
class LocationPingAdmin(admin.ModelAdmin):
    list_display = ("id", "shift", "latitude", "longitude", "recorded_at")
    search_fields = ("client_uuid", "shift__user__email")
