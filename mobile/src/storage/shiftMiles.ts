import AsyncStorage from "@react-native-async-storage/async-storage";

const SHIFT_MILES_KEY = "active_shift_miles_v1";

export type ShiftMilesProgress = {
  shiftId?: number;
  shiftClientUuid?: string;
  localMiles: number;
  /** Epoch ms when GPS last moved enough to count as progress. */
  lastMovedAt?: number | null;
  lastPoint?: {
    latitude: number;
    longitude: number;
    recordedAtMs?: number;
  } | null;
  initialLocation?: {
    latitude: number;
    longitude: number;
    recordedAtMs?: number;
  } | null;
};

function sameShift(
  a: { shiftId?: number; shiftClientUuid?: string },
  b: { shiftId?: number; shiftClientUuid?: string }
): boolean {
  if (a.shiftId && b.shiftId && a.shiftId === b.shiftId) return true;
  if (
    a.shiftClientUuid &&
    b.shiftClientUuid &&
    a.shiftClientUuid === b.shiftClientUuid
  ) {
    return true;
  }
  return false;
}

export async function loadShiftMilesProgress(): Promise<ShiftMilesProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(SHIFT_MILES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShiftMilesProgress;
    if (!parsed?.shiftId && !parsed?.shiftClientUuid) return null;
    if (typeof parsed.localMiles !== "number" || Number.isNaN(parsed.localMiles)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveShiftMilesProgress(
  progress: ShiftMilesProgress | null
): Promise<void> {
  try {
    if (
      !progress ||
      (!progress.shiftId && !progress.shiftClientUuid)
    ) {
      await AsyncStorage.removeItem(SHIFT_MILES_KEY);
      return;
    }
    await AsyncStorage.setItem(SHIFT_MILES_KEY, JSON.stringify(progress));
  } catch {
    // ignore persist failures
  }
}

export async function clearShiftMilesProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SHIFT_MILES_KEY);
  } catch {
    // ignore
  }
}

/** Hydrate persisted miles only when they belong to the open shift. */
export async function loadMilesForShift(shift: {
  id?: number;
  client_uuid?: string;
}): Promise<ShiftMilesProgress | null> {
  const stored = await loadShiftMilesProgress();
  if (!stored) return null;
  if (
    !sameShift(
      { shiftId: shift.id || undefined, shiftClientUuid: shift.client_uuid },
      {
        shiftId: stored.shiftId,
        shiftClientUuid: stored.shiftClientUuid,
      }
    )
  ) {
    return null;
  }
  return stored;
}
