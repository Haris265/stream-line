export const LOCATION_TASK_NAME = "TIMESTREAM_BACKGROUND_LOCATION";
export const KM_TO_MILES = 0.621371;
/** Near-real-time sampling while on shift (~25 m or 10 s). */
export const LOCATION_DISTANCE_INTERVAL_M = 25;
export const LOCATION_TIME_INTERVAL_MS = 10000;

/** Home-screen location hint: wait this long after clock-in before warning. */
export const LOCATION_HINT_GRACE_MS = 2 * 60 * 1000;
/** Treat as idle miles when below this (same idea as admin not_driving). */
export const LOCATION_HINT_IDLE_MILES = 0.05;

export type LocationHint = "none" | "waiting_gps" | "not_moving";

/** Reject fixes worse than this horizontal accuracy (meters). */
export const MAX_ACCURACY_M = 20;
/** Ignore jitter shorter than this (meters). */
export const MIN_SEGMENT_M = 10;
/** Reject teleports faster than this (m/s, ~112 mph). */
export const MAX_SPEED_MPS = 50;
/** Car/bike only: ignore walking/stationary below this (m/s, ~5.4 km/h); slow bikes/traffic still count. */
export const MIN_DRIVING_SPEED_MPS = 1.5;
/** Treat lat/lon both near zero as invalid Null Island. */
export const NULL_ISLAND_EPS = 0.0001;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

export function isValidCoordinate(
  latitude: number,
  longitude: number
): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (
    Math.abs(latitude) < NULL_ISLAND_EPS &&
    Math.abs(longitude) < NULL_ISLAND_EPS
  ) {
    return false;
  }
  return true;
}

export function isAccurateEnough(accuracy: number | null | undefined): boolean {
  if (accuracy == null || Number.isNaN(Number(accuracy))) return true;
  return Number(accuracy) <= MAX_ACCURACY_M;
}

export function isUsableGpsFix(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): boolean {
  return (
    isValidCoordinate(coords.latitude, coords.longitude) &&
    isAccurateEnough(coords.accuracy)
  );
}

/**
 * Decide whether to accept a new fix and whether to add its segment length.
 * - acceptPoint: update last/previous location
 * - addDistanceKm: kilometers to add (0 if seed / too small / rejected)
 */
export function shouldAcceptSegment(
  prev: GeoPoint | null,
  next: GeoPoint,
  meta?: {
    accuracy?: number | null;
    speed?: number | null;
    prevRecordedAtMs?: number | null;
    nextRecordedAtMs?: number | null;
  }
): { acceptPoint: boolean; addDistanceKm: number } {
  if (!isUsableGpsFix({ ...next, accuracy: meta?.accuracy })) {
    return { acceptPoint: false, addDistanceKm: 0 };
  }

  // First valid lock: seed only, no distance.
  if (!prev || !isValidCoordinate(prev.latitude, prev.longitude)) {
    return { acceptPoint: true, addDistanceKm: 0 };
  }

  const km = haversineKm(
    prev.latitude,
    prev.longitude,
    next.latitude,
    next.longitude
  );
  const meters = km * 1000;

  if (meters < MIN_SEGMENT_M) {
    return { acceptPoint: true, addDistanceKm: 0 };
  }

  // Device GPS speed (m/s). Known walking/stationary → no miles.
  const deviceSpeed = meta?.speed;
  const hasKnownSpeed =
    deviceSpeed != null &&
    Number.isFinite(deviceSpeed) &&
    deviceSpeed >= 0;
  if (hasKnownSpeed && deviceSpeed! < MIN_DRIVING_SPEED_MPS) {
    return { acceptPoint: true, addDistanceKm: 0 };
  }

  const prevAt = meta?.prevRecordedAtMs;
  const nextAt = meta?.nextRecordedAtMs;
  if (
    prevAt != null &&
    nextAt != null &&
    Number.isFinite(prevAt) &&
    Number.isFinite(nextAt)
  ) {
    const dtSec = (nextAt - prevAt) / 1000;
    if (dtSec > 0) {
      const speedMps = meters / dtSec;
      if (speedMps > MAX_SPEED_MPS) {
        return { acceptPoint: false, addDistanceKm: 0 };
      }
      // Unknown device speed: require car/bike pace from segment timing.
      if (!hasKnownSpeed && speedMps < MIN_DRIVING_SPEED_MPS) {
        return { acceptPoint: true, addDistanceKm: 0 };
      }
    } else if (dtSec < 0) {
      return { acceptPoint: false, addDistanceKm: 0 };
    } else if (meters >= MIN_SEGMENT_M) {
      // Same timestamp with a real move → teleport / bad clock.
      return { acceptPoint: false, addDistanceKm: 0 };
    }
  } else if (!hasKnownSpeed) {
    // Cannot verify driving pace without timestamps.
    return { acceptPoint: true, addDistanceKm: 0 };
  }

  return { acceptPoint: true, addDistanceKm: km };
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(Number(hours))) return "—";
  const h = Math.floor(Number(hours));
  const m = Math.round((Number(hours) - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatMiles(miles: number | null | undefined): string {
  if (miles == null || Number.isNaN(Number(miles))) return "0.00 mi";
  return `${Number(miles).toFixed(2)} mi`;
}

export function newClientUuid(): string {
  // RFC4122-ish uuid v4 without depending on native crypto modules
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Employee Home: warn when GPS stuck on one spot after grace period. */
export function resolveLocationHint(opts: {
  clockIn: string | null | undefined;
  isOnBreak: boolean;
  initialLocation: GeoPoint | null;
  lastPoint: GeoPoint | null;
  localMiles: number;
  lastMovedAt: number | null;
  now?: number;
}): LocationHint {
  if (opts.isOnBreak || !opts.clockIn) return "none";

  const now = opts.now ?? Date.now();
  const clockInMs = Date.parse(opts.clockIn);
  if (!Number.isFinite(clockInMs)) return "none";
  if (now - clockInMs < LOCATION_HINT_GRACE_MS) return "none";

  if (!opts.initialLocation) return "waiting_gps";

  if (opts.localMiles >= LOCATION_HINT_IDLE_MILES) return "none";

  if (
    opts.lastMovedAt != null &&
    now - opts.lastMovedAt < LOCATION_HINT_GRACE_MS
  ) {
    return "none";
  }

  const last = opts.lastPoint ?? opts.initialLocation;
  const movedM =
    haversineKm(
      opts.initialLocation.latitude,
      opts.initialLocation.longitude,
      last.latitude,
      last.longitude
    ) * 1000;

  if (movedM >= LOCATION_DISTANCE_INTERVAL_M) return "none";

  return "not_moving";
}
