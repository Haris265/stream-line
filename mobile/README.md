# TimeStream mobile (Expo)

Expo SDK 57 app: clock in/out, on-shift-only GPS mileage, history, and admin live status + CSV export.

## Setup

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your machine IP when testing on a physical device, e.g.
# EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/api
npm install --legacy-peer-deps
npx expo start
```

Use a **development build** or Expo Go with location permissions. Background GPS requires a native build (`npx expo prebuild` + run on device) for full reliability.

## Screens

- **Login** — JWT against Django API
- **Clock** — clock in / out, live timer, miles this shift
- **History** — past shifts (hours + miles)
- **Admin** (admin role) — live team status + CSV share

## Tracking rules

- Location starts only after clock-in
- Stops on clock-out
- Pings enqueue offline (AsyncStorage) and sync via `/api/sync/batch/`
- Miles shown in the UI; server stores km and returns `total_miles`

## Demo login

- Employee: `employee@timestream.local` / `emp123`
- Admin: `admin@timestream.local` / `admin123`
