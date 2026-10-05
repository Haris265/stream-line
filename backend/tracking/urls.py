from django.urls import path

from . import admin_views, views

urlpatterns = [
    path("shifts/clock-in/", views.ClockInView.as_view(), name="shift-clock-in"),
    path(
        "shifts/<int:pk>/clock-out/",
        views.ClockOutView.as_view(),
        name="shift-clock-out",
    ),
    path("shifts/current/", views.CurrentShiftView.as_view(), name="shift-current"),
    path("shifts/", views.ShiftListView.as_view(), name="shift-list"),
    path(
        "shifts/<int:pk>/pings/",
        views.PingBatchView.as_view(),
        name="shift-pings",
    ),
    path(
        "shifts/<int:pk>/break/start/",
        views.BreakStartView.as_view(),
        name="shift-break-start",
    ),
    path(
        "shifts/<int:pk>/break/end/",
        views.BreakEndView.as_view(),
        name="shift-break-end",
    ),
    path("sync/batch/", views.SyncBatchView.as_view(), name="sync-batch"),
    path(
        "admin/live-status/",
        admin_views.LiveStatusView.as_view(),
        name="admin-live-status",
    ),
    path(
        "admin/employees/",
        admin_views.EmployeeListView.as_view(),
        name="admin-employees",
    ),
    path(
        "admin/export/csv/",
        admin_views.ExportCsvView.as_view(),
        name="admin-export-csv",
    ),
]
