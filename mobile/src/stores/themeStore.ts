import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { getColors, type ThemeColors, type ThemeMode } from "../theme";

const STORAGE_KEY = "appearance_mode";

type ThemeState = {
  mode: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  hydrated: false,
  async hydrate() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        set({ mode: saved, hydrated: true });
        return;
      }
    } catch {
      // keep default
    }
    set({ hydrated: true });
  },
  async setMode(mode) {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore persist failures
    }
  },
}));

export function useThemeColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  return getColors(mode);
}
