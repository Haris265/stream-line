# Stream Line / TimeStream backend

Django 5 + Django REST Framework API for on-shift hours and GPS mileage tracking.

## Setup

```bash
cd backend
python3 -m virtualenv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # or use demo users below
python manage.py runserver 0.0.0.0:8000
```

## Demo users

Created by the initial setup script (recreate if needed):

| Email | Password | Role |
|-------|----------|------|
| admin@timestream.local | admin123 | admin |
| employee@timestream.local | emp123 | employee |

Create more employees in Django admin at http://127.0.0.1:8000/admin/

## Auth

- `POST /api/auth/login/` `{ "email", "password" }` → JWT access + refresh
- `POST /api/auth/refresh/` `{ "refresh" }`
- `POST /api/auth/logout/` `{ "refresh" }`
- `GET /api/auth/me/`

## Shifts & GPS

- `POST /api/shifts/clock-in/` — start shift (optional `client_uuid`)
- `POST /api/shifts/{id}/clock-out/` — end shift; finalizes hours + km
- `GET /api/shifts/current/`
- `GET /api/shifts/` — own history (`?user=` for admin)
- `POST /api/shifts/{id}/pings/` `{ "pings": [{ lat, lng, recorded_at, client_uuid }] }`
- `POST /api/sync/batch/` — offline idempotent clock + ping sync

Distance is stored in **km** (`total_distance_km`); APIs also return `total_miles`.

## Admin

- `GET /api/admin/live-status/` — who is on clock + last GPS + live hours/miles
- `GET /api/admin/employees/`
- `GET /api/admin/export/csv/?start=YYYY-MM-DD&end=YYYY-MM-DD`

## Env

Copy `.env.example` if present. Defaults use SQLite and `DEBUG=true`.
