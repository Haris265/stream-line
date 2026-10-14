from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import LocationPing, Shift
from .utils import distance_from_pings, km_to_miles, shift_activity_status

User = get_user_model()


class SyncBatchMilesTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="emp@test.local",
            password="pass12345",
            first_name="E",
            last_name="M",
        )
        token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    def test_sync_pings_ack_and_recompute_miles(self):
        shift_uuid = uuid4()
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=shift_uuid,
        )
        ping_a = str(uuid4())
        ping_b = str(uuid4())
        t0 = timezone.now()
        t1 = t0 + timedelta(seconds=60)

        res = self.client.post(
            "/api/sync/batch/",
            {
                "pings": [
                    {
                        "client_uuid": ping_a,
                        "shift_client_uuid": str(shift_uuid),
                        "latitude": 37.7749,
                        "longitude": -122.4194,
                        "accuracy": 10,
                        "recorded_at": t0.isoformat(),
                    },
                    {
                        "client_uuid": ping_b,
                        "shift_client_uuid": str(shift_uuid),
                        "latitude": 37.7758,
                        "longitude": -122.4194,
                        "accuracy": 10,
                        "recorded_at": t1.isoformat(),
                    },
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertEqual(body["pings_created"], 2)
        self.assertIn(ping_a, body["accepted_ping_uuids"])
        self.assertIn(ping_b, body["accepted_ping_uuids"])
        self.assertIsNotNone(body["shift"])
        self.assertGreater(body["shift"]["total_miles"], 0)
        # ~100m walk — far below the old 14k-mile bug scale
        self.assertLess(body["shift"]["total_miles"], 1)

        shift.refresh_from_db()
        self.assertGreater(float(shift.total_distance_km), 0)
        self.assertEqual(LocationPing.objects.filter(shift=shift).count(), 2)

    def test_orphan_ping_skipped_when_no_open_shift(self):
        orphan = str(uuid4())
        res = self.client.post(
            "/api/sync/batch/",
            {
                "pings": [
                    {
                        "client_uuid": orphan,
                        "shift_client_uuid": str(uuid4()),
                        "latitude": 1.0,
                        "longitude": 1.0,
                        "recorded_at": timezone.now().isoformat(),
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertEqual(body["pings_created"], 0)
        self.assertIn(orphan, body["skipped_ping_uuids"])
        self.assertEqual(LocationPing.objects.count(), 0)

    def test_duplicate_ping_still_acked(self):
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        ping_uuid = uuid4()
        LocationPing.objects.create(
            shift=shift,
            client_uuid=ping_uuid,
            latitude=Decimal("10.0"),
            longitude=Decimal("10.0"),
            recorded_at=timezone.now(),
        )
        res = self.client.post(
            "/api/sync/batch/",
            {
                "pings": [
                    {
                        "client_uuid": str(ping_uuid),
                        "shift_id": shift.id,
                        "latitude": 10.0,
                        "longitude": 10.0,
                        "recorded_at": timezone.now().isoformat(),
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["pings_created"], 0)
        self.assertIn(str(ping_uuid), res.json()["accepted_ping_uuids"])


class DistanceFilterTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="filter@test.local",
            password="pass12345",
            first_name="F",
            last_name="T",
        )

    def _ping(self, shift, lat, lon, seconds, accuracy=10.0, speed=None):
        return LocationPing.objects.create(
            shift=shift,
            client_uuid=uuid4(),
            latitude=Decimal(str(lat)),
            longitude=Decimal(str(lon)),
            accuracy=accuracy,
            speed=speed,
            recorded_at=timezone.now() + timedelta(seconds=seconds),
        )

    def test_ignores_null_island_and_poor_accuracy(self):
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        self._ping(shift, 0.0, 0.0, 0)  # invalid
        self._ping(shift, 37.7749, -122.4194, 10, accuracy=80)  # poor accuracy
        self._ping(shift, 37.7749, -122.4194, 20, accuracy=10)
        self._ping(shift, 37.7758, -122.4194, 80, accuracy=10)

        km = float(distance_from_pings(shift.pings.order_by("recorded_at")))
        self.assertGreater(km, 0.05)
        self.assertLess(km, 0.2)
        self.assertLess(km_to_miles(km), 1)

    def test_ignores_teleport_between_good_points(self):
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        # ~100m in 60s, then jump to NYC in 1s, then continue near SF
        self._ping(shift, 37.7749, -122.4194, 0)
        self._ping(shift, 37.7758, -122.4194, 60)
        self._ping(shift, 40.7128, -74.0060, 61)  # teleport
        self._ping(shift, 37.7767, -122.4194, 120)

        km = float(distance_from_pings(shift.pings.order_by("recorded_at")))
        # Two ~100m segments only; teleport discarded
        self.assertGreater(km, 0.1)
        self.assertLess(km, 0.5)
        self.assertLess(km_to_miles(km), 1)

    def test_ignores_walking_speed_segments(self):
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        # ~100m between points; walking speed must not count, driving must.
        # MIN_DRIVING_SPEED_MPS is 1.5 — walking must stay strictly below it.
        self._ping(shift, 37.7749, -122.4194, 0, speed=0.0)
        self._ping(shift, 37.7758, -122.4194, 60, speed=1.0)  # walking
        walking_only = float(
            distance_from_pings(shift.pings.order_by("recorded_at"))
        )
        self.assertEqual(walking_only, 0.0)

        self._ping(shift, 37.7767, -122.4194, 120, speed=10.0)  # driving
        km = float(distance_from_pings(shift.pings.order_by("recorded_at")))
        self.assertGreater(km, 0.05)
        self.assertLess(km, 0.2)

    def test_null_speed_rejects_walking_pace_implied(self):
        """No device speed: ~100m in 120s ≈ 0.83 m/s → walk, no miles."""
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        self._ping(shift, 37.7749, -122.4194, 0, speed=None)
        self._ping(shift, 37.7758, -122.4194, 120, speed=None)
        km = float(distance_from_pings(shift.pings.order_by("recorded_at")))
        self.assertEqual(km, 0.0)

    def test_null_speed_counts_driving_pace_implied(self):
        """No device speed: ~100m in 20s ≈ 5 m/s → car/bike pace, count."""
        shift = Shift.objects.create(
            user=self.user,
            clock_in=timezone.now(),
            client_uuid=uuid4(),
        )
        self._ping(shift, 37.7749, -122.4194, 0, speed=None)
        self._ping(shift, 37.7758, -122.4194, 20, speed=None)
        km = float(distance_from_pings(shift.pings.order_by("recorded_at")))
        self.assertGreater(km, 0.05)
        self.assertLess(km, 0.2)


class ActivityStatusTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="activity@test.local",
            password="pass12345",
            first_name="A",
            last_name="S",
        )
        self.now = timezone.now()

    def _shift(self, minutes_ago=10, **kwargs):
        return Shift.objects.create(
            user=self.user,
            clock_in=self.now - timedelta(minutes=minutes_ago),
            client_uuid=uuid4(),
            **kwargs,
        )

    def _ping(self, shift, minutes_ago=1, speed=None, lat=37.7749, lon=-122.4194):
        return LocationPing.objects.create(
            shift=shift,
            client_uuid=uuid4(),
            latitude=Decimal(str(lat)),
            longitude=Decimal(str(lon)),
            accuracy=10.0,
            speed=speed,
            recorded_at=self.now - timedelta(minutes=minutes_ago),
        )

    def test_on_break(self):
        shift = self._shift(is_on_break=True, break_started_at=self.now)
        result = shift_activity_status(shift, None, now=self.now)
        self.assertEqual(result["activity_status"], "on_break")
        self.assertEqual(result["activity_label"], "On break")

    def test_starting_grace_period(self):
        shift = self._shift(minutes_ago=2)
        result = shift_activity_status(shift, None, now=self.now)
        self.assertEqual(result["activity_status"], "starting")

    def test_no_gps_when_no_pings(self):
        shift = self._shift(minutes_ago=10)
        result = shift_activity_status(shift, None, now=self.now)
        self.assertEqual(result["activity_status"], "no_gps")
        self.assertIsNone(result["minutes_since_last_ping"])

    def test_no_gps_when_stale_ping(self):
        shift = self._shift(minutes_ago=20)
        ping = self._ping(shift, minutes_ago=10)
        result = shift_activity_status(shift, ping, now=self.now)
        self.assertEqual(result["activity_status"], "no_gps")
        self.assertEqual(result["minutes_since_last_ping"], 10.0)

    def test_not_driving_when_stationary(self):
        shift = self._shift(minutes_ago=15, total_distance_km=Decimal("0"))
        ping = self._ping(shift, minutes_ago=1, speed=0.2)
        result = shift_activity_status(shift, ping, now=self.now)
        self.assertEqual(result["activity_status"], "not_driving")
        self.assertEqual(result["last_speed_mps"], 0.2)

    def test_driving_when_miles_accrued(self):
        # 0.1 km ≈ 0.062 miles > 0.05 threshold
        shift = self._shift(minutes_ago=15, total_distance_km=Decimal("0.1"))
        ping = self._ping(shift, minutes_ago=1, speed=0.0)
        result = shift_activity_status(shift, ping, now=self.now)
        self.assertEqual(result["activity_status"], "driving")

    def test_driving_when_speed_above_threshold(self):
        shift = self._shift(minutes_ago=15, total_distance_km=Decimal("0"))
        ping = self._ping(shift, minutes_ago=1, speed=5.0)
        result = shift_activity_status(shift, ping, now=self.now)
        self.assertEqual(result["activity_status"], "driving")
        self.assertEqual(result["last_speed_mps"], 5.0)


class LiveStatusActivityApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="live@test.local",
            password="pass12345",
            first_name="L",
            last_name="S",
        )
        token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        self.now = timezone.now()

    def test_live_status_includes_activity_fields(self):
        shift = Shift.objects.create(
            user=self.user,
            clock_in=self.now - timedelta(minutes=15),
            client_uuid=uuid4(),
            total_distance_km=Decimal("0"),
        )
        LocationPing.objects.create(
            shift=shift,
            client_uuid=uuid4(),
            latitude=Decimal("37.774900"),
            longitude=Decimal("-122.419400"),
            accuracy=10.0,
            speed=0.1,
            recorded_at=self.now - timedelta(minutes=1),
        )

        res = self.client.get("/api/admin/live-status/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        body = res.json()
        self.assertEqual(len(body), 1)
        row = body[0]
        self.assertEqual(row["activity_status"], "not_driving")
        self.assertEqual(row["activity_label"], "Not driving")
        self.assertIn("minutes_since_last_ping", row)
        self.assertIn("last_speed_mps", row)
        self.assertAlmostEqual(row["last_speed_mps"], 0.1)
