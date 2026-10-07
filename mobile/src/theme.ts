export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  mutedSoft: string;
  accent: string;
  accentText: string;
  danger: string;
  dangerSoft: string;
  onClockBg: string;
  onClockDot: string;
  offClockBg: string;
  offClockDot: string;
  link: string;
  privacyLink: string;
  iconAccentBg: string;
  iconMutedBg: string;
  iconDangerBg: string;
};

export const darkColors: ThemeColors = {
  bg: "#0B132B",
  surface: "#1e293b",
  border: "#334155",
  text: "#ffffff",
  muted: "#94a3b8",
  mutedSoft: "#64748b",
  accent: "#2563EB",
  accentText: "#ffffff",
  danger: "#ef4444",
  dangerSoft: "#f87171",
  onClockBg: "#14532d",
  onClockDot: "#22c55e",
  offClockBg: "#1e293b",
  offClockDot: "#64748b",
  link: "#94a3b8",
  privacyLink: "#7dd3fc",
  iconAccentBg: "rgba(245, 158, 11, 0.15)",
  iconMutedBg: "rgba(148, 163, 184, 0.12)",
  iconDangerBg: "rgba(239, 68, 68, 0.12)",
};

export const lightColors: ThemeColors = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  accent: "#2563EB",
  accentText: "#ffffff",
  danger: "#dc2626",
  dangerSoft: "#ef4444",
  onClockBg: "#dcfce7",
  onClockDot: "#16a34a",
  offClockBg: "#f1f5f9",
  offClockDot: "#94a3b8",
  link: "#64748B",
  privacyLink: "#0284c7",
  iconAccentBg: "rgba(37, 99, 235, 0.12)",
  iconMutedBg: "rgba(100, 116, 139, 0.12)",
  iconDangerBg: "rgba(220, 38, 38, 0.1)",
};

/** Default (dark) — for splash and any non-reactive fallbacks */
export const colors = darkColors;

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === "light" ? lightColors : darkColors;
}

export const fonts = {
  heading: "Syne_700Bold",
  headingExtra: "Syne_800ExtraBold",
  body: "Amethysta_400Regular",
};

export const spacing = {
  screen: 24,
  gap: 12,
};
