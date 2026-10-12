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
  isUsableGpsFix,
  newClientUuid,
  shouldAcceptSegment,
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
let foregroundWatchSub: Location.LocationSubscription | null = null;
let lastHandledFix: {
  latitude: number;
  longitude: number;
  at: number;
} | null = null;

const watchOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: LOCATION_TIME_INTERVAL_MS,
  distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
};

/** Drop near-duplicate deliveries when FG watch + BG task both fire. */
const DEDUPE_WINDOW_MS = 5000;
const DEDUPE_MIN_KM = 0.01; // ~10 m

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

  const { latitude, longitude, accuracy, speed } = loc.coords;
  const at = loc.timestamp;

  if (__DEV__) {
    console.log("[location] speed m/s:", speed);
  }

  // Drop (0,0) / out-of-range / poor accuracy before any distance work.
  if (!isUsableGpsFix({ latitude, longitude, accuracy })) {
    return;
  }

  if (lastHandledFix) {
    const dt = at - lastHandledFix.at;
    const km = haversineKm(
      lastHandledFix.latitude,
      lastHandledFix.longitude,
      latitude,
      longitude
    );
    if (dt >= 0 && dt < DEDUPE_WINDOW_MS && km < DEDUPE_MIN_KM) {
      return;
    }

    const segment = shouldAcceptSegment(
      lastHandledFix,
      { latitude, longitude },
      {
        accuracy,
        speed,
        prevRecordedAtMs: lastHandledFix.at,
        nextRecordedAtMs: at,
      }
    );
    // Teleport / bad speed: keep previous good fix, do not enqueue.
    if (!segment.acceptPoint) {
      return;
    }
  }

  lastHandledFix = { latitude, longitude, at };

  const recorded_at = new Date(at).toISOString();
  const payload = {
    client_uuid: newClientUuid(),
    shift_id: meta.shiftId,
    shift_client_uuid: meta.shiftClientUuid,
    latitude,
    longitude,
    accuracy,
    speed,
    recorded_at,
  };

  try {
    await enqueuePing(payload);
  } catch (e) {
    console.warn("Failed to enqueue location ping", e);
  }

  // Always update live UI miles even if the queue write failed.
  onLocation?.({
    latitude,
    longitude,
    accuracy,
    speed,
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

async function startForegroundWatch(): Promise<boolean> {
  if (foregroundWatchSub) return false;
  foregroundWatchSub = await Location.watchPositionAsync(
    watchOptions,
    (loc) => {
      void handleLocationFix(loc);
    }
  );
  return true;
}

async function seedCurrentPosition() {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await handleLocationFix(loc);
  } catch (e) {
    console.warn("Failed to seed current position", e);
  }
}

async function startNativeBackgroundUpdates() {
  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    ...watchOptions,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Forever Culture — on shift",
      notificationBody: "GPS mileage is tracking while you are clocked in.",
      notificationColor: "#0B3D2E",
    },
    pausesUpdatesAutomatically: false,
  });
}

export async function startBackgroundTracking(meta: ActiveShiftMeta) {
  await setActiveShiftMeta(meta);

  // Foreground watch keeps localMiles updating while the app is open
  // (background TaskManager often runs outside the React JS context).
  const startedFresh = await startForegroundWatch();
  if (startedFresh) {
    await seedCurrentPosition();
  }

  if (Platform.OS !== "web") {
    await startNativeBackgroundUpdates();
  }
}

export async function stopBackgroundTracking() {
  await setActiveShiftMeta(null);

  foregroundWatchSub?.remove();
  foregroundWatchSub = null;
  lastHandledFix = null;

  if (Platform.OS === "web") return;

  const started = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export { haversineKm };
