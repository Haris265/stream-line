import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";

import { useAuthStore } from "../src/stores/trackingStore";
import { useTrackingStore } from "../src/stores/trackingStore";
import { colors } from "../src/theme";
// Register background location task at startup
import "../src/tracking/locationService";

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

const PUBLIC = new Set(["login", "privacy"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const refreshCurrent = useTrackingStore((s) => s.refreshCurrent);
  const attachLocationHandler = useTrackingStore((s) => s.attachLocationHandler);
  const flushSync = useTrackingStore((s) => s.flushSync);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (loading) return;
    const root = segments[0];
    const inPublic = PUBLIC.has(String(root));
    if (!user && !inPublic) {
      router.replace("/login");
    } else if (user && root === "login") {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

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

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
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
