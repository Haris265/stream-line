from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import LocationPing, Shift

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

        res = self.client.post(
            "/api/sync/batch/",
            {
                "pings": [
                    {
                        "client_uuid": ping_a,
                        "shift_client_uuid": str(shift_uuid),
                        "latitude": 37.7749,
                        "longitude": -122.4194,
                        "recorded_at": timezone.now().isoformat(),
                    },
                    {
                        "client_uuid": ping_b,
                        "shift_client_uuid": str(shift_uuid),
                        "latitude": 37.7849,
                        "longitude": -122.4094,
                        "recorded_at": timezone.now().isoformat(),
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
