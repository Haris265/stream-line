import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_SHIFT_KEY = "active_shift_meta_v1";

export type ActiveShiftMeta = {
  shiftId?: number;
  shiftClientUuid?: string;
};

export async function loadActiveShiftMeta(): Promise<ActiveShiftMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveShiftMeta;
    if (!parsed?.shiftId && !parsed?.shiftClientUuid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveActiveShiftMeta(
  meta: ActiveShiftMeta | null
): Promise<void> {
  try {
    if (!meta || (!meta.shiftId && !meta.shiftClientUuid)) {
      await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
      return;
    }
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(meta));
  } catch {
    // ignore persist failures
  }
}

export async function clearActiveShiftMeta(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
  } catch {
    // ignore
  }
}
