export const LOCATION_TASK_NAME = "TIMESTREAM_BACKGROUND_LOCATION";
export const KM_TO_MILES = 0.621371;
export const LOCATION_DISTANCE_INTERVAL_M = 50;
export const LOCATION_TIME_INTERVAL_MS = 30000;

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
