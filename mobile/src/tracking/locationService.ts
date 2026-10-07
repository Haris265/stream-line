import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { enqueuePing } from "../storage/queue";
import {
  LOCATION_DISTANCE_INTERVAL_M,
  LOCATION_TASK_NAME,
  LOCATION_TIME_INTERVAL_MS,
  haversineKm,
  newClientUuid,
} from "./constants";

type LocationHandler = (coords: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
}) => void;

let onLocation: LocationHandler | null = null;
let activeShiftMeta: {
  shiftId?: number;
  shiftClientUuid?: string;
} | null = null;

export function setLocationHandler(handler: LocationHandler | null) {
  onLocation = handler;
}

export function setActiveShiftMeta(meta: {
  shiftId?: number;
  shiftClientUuid?: string;
} | null) {
  activeShiftMeta = meta;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("Location task error", error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })
    ?.locations;
  if (!locations?.length || !activeShiftMeta) return;

  for (const loc of locations) {
    const recorded_at = new Date(loc.timestamp).toISOString();
    const payload = {
      client_uuid: newClientUuid(),
      shift_id: activeShiftMeta.shiftId,
      shift_client_uuid: activeShiftMeta.shiftClientUuid,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      recorded_at,
    };
    await enqueuePing(payload);
    onLocation?.({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      recorded_at,
    });
  }
});

export async function requestTrackingPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === "granted" || fg.status === "granted";
}

export async function startBackgroundTracking(meta: {
  shiftId?: number;
  shiftClientUuid?: string;
}) {
  setActiveShiftMeta(meta);
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: LOCATION_TIME_INTERVAL_MS,
    distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Forever Culture — on shift",
      notificationBody: "GPS mileage is tracking while you are clocked in.",
      notificationColor: "#0B3D2E",
    },
    pausesUpdatesAutomatically: false,
  });
}

export async function stopBackgroundTracking() {
  setActiveShiftMeta(null);
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export { haversineKm };
