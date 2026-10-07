import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";

import { SplashScreen } from "../src/components/SplashScreen";
import { useAuthStore } from "../src/stores/trackingStore";
import { useTrackingStore } from "../src/stores/trackingStore";
import { colors } from "../src/theme";
// Register background location task at startup
import "../src/tracking/locationService";

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const PUBLIC = new Set(["login", "privacy"]);
const SPLASH_MIN_MS = 2000;

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrate } = useAuthStore();
  const [minElapsed, setMinElapsed] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const refreshCurrent = useTrackingStore((s) => s.refreshCurrent);
  const attachLocationHandler = useTrackingStore((s) => s.attachLocationHandler);
  const flushSync = useTrackingStore((s) => s.flushSync);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const id = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, []);

  const showSplash = loading || !minElapsed;

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthGate>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="consent" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </SafeAreaProvider>
  );
}
