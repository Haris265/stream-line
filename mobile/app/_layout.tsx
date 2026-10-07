import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import {
  Syne_700Bold,
  Syne_800ExtraBold,
} from "@expo-google-fonts/syne";
import { Amethysta_400Regular } from "@expo-google-fonts/amethysta";

import { SplashScreen } from "../src/components/SplashScreen";
import { useThemeColors, useThemeStore } from "../src/stores/themeStore";
import { useAuthStore } from "../src/stores/trackingStore";
import { useTrackingStore } from "../src/stores/trackingStore";
import { darkColors } from "../src/theme";
// Register background location task at startup
import "../src/tracking/locationService";

SystemUI.setBackgroundColorAsync(darkColors.bg).catch(() => {});

const PUBLIC = new Set(["login", "privacy"]);
const SPLASH_MIN_MS = 2000;

function AuthGate({
  children,
  fontsReady,
}: {
  children: React.ReactNode;
  fontsReady: boolean;
}) {
  const { user, loading, hydrate } = useAuthStore();
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const [minElapsed, setMinElapsed] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const refreshCurrent = useTrackingStore((s) => s.refreshCurrent);
  const attachLocationHandler = useTrackingStore((s) => s.attachLocationHandler);
  const flushSync = useTrackingStore((s) => s.flushSync);

  useEffect(() => {
    hydrate();
    hydrateTheme();
  }, [hydrate, hydrateTheme]);

  useEffect(() => {
    const id = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, []);

  const showSplash = loading || !minElapsed || !fontsReady;

  useEffect(() => {
    if (showSplash) return;
    const root = segments[0];
    const inPublic = PUBLIC.has(String(root));
    if (!user && !inPublic) {
      router.replace("/login");
    } else if (user && root === "login") {
      router.replace("/(tabs)");
    }
  }, [user, showSplash, segments, router]);

  useEffect(() => {
    if (!user) return;
    attachLocationHandler();
    refreshCurrent();
    flushSync();
    const id = setInterval(() => {
      flushSync();
    }, 30000);
    return () => clearInterval(id);
  }, [user, attachLocationHandler, refreshCurrent, flushSync]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}

function ThemedApp() {
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    Amethysta_400Regular,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  return (
    <AuthGate fontsReady={fontsLoaded}>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="consent" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemedApp />
    </SafeAreaProvider>
  );
}
