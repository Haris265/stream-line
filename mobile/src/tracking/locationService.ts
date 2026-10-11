import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  clearActiveShiftMeta,
  loadActiveShiftMeta,
  saveActiveShiftMeta,
  type ActiveShiftMeta,
} from "../storage/activeShift";
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
let activeShiftMeta: ActiveShiftMeta | null = null;
let webWatchSub: Location.LocationSubscription | null = null;

export function setLocationHandler(handler: LocationHandler | null) {
  onLocation = handler;
}

export async function setActiveShiftMeta(meta: ActiveShiftMeta | null) {
  activeShiftMeta = meta;
  if (meta) {
    await saveActiveShiftMeta(meta);
  } else {
    await clearActiveShiftMeta();
  }
}

async function resolveActiveShiftMeta(): Promise<ActiveShiftMeta | null> {
  if (activeShiftMeta?.shiftId || activeShiftMeta?.shiftClientUuid) {
    return activeShiftMeta;
  }
  const stored = await loadActiveShiftMeta();
  if (stored) {
    activeShiftMeta = stored;
  }
  return stored;
}

async function handleLocationFix(loc: Location.LocationObject) {
  const meta = await resolveActiveShiftMeta();
  if (!meta?.shiftId && !meta?.shiftClientUuid) return;

  const recorded_at = new Date(loc.timestamp).toISOString();
  const payload = {
    client_uuid: newClientUuid(),
    shift_id: meta.shiftId,
    shift_client_uuid: meta.shiftClientUuid,
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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("Location task error", error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })
    ?.locations;
  if (!locations?.length) return;

  for (const loc of locations) {
    await handleLocationFix(loc);
  }
});

export async function requestTrackingPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  if (Platform.OS === "web") return true;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === "granted";
}

export async function startBackgroundTracking(meta: ActiveShiftMeta) {
  await setActiveShiftMeta(meta);

  if (Platform.OS === "web") {
    if (webWatchSub) return;
    webWatchSub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_TIME_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
      },
      (loc) => {
        void handleLocationFix(loc);
      }
    );
    return;
  }

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
  await setActiveShiftMeta(null);

  if (Platform.OS === "web") {
    webWatchSub?.remove();
    webWatchSub = null;
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export { haversineKm };
