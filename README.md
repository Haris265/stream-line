# Stream Line — Hours + Miles

TimeStream-style employee time clock with **on-shift GPS mileage**.

| Folder | Stack |
|--------|--------|
| [backend/](backend/) | Django 5 + DRF + SimpleJWT |
| [mobile/](mobile/) | Expo SDK 57 + Expo Router |

## Quick start

**API**

```bash
cd backend
source .venv/bin/activate   # or create venv + pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

**App**

```bash
cd mobile
cp .env.example .env
npm install --legacy-peer-deps
npx expo start
```

Demo logins (see backend README):

- `employee@timestream.local` / `emp123`
- `admin@timestream.local` / `admin123`
