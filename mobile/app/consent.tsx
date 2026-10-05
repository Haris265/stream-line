import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useTrackingStore } from "../src/stores/trackingStore";
import { colors, spacing } from "../src/theme";

const BULLETS = [
  "Tracking starts when you clock in and stops the moment you clock out.",
  "We never track your location when you are off the clock.",
  "Your employer uses this to verify on-site hours — nothing more.",
  "A notification stays in your status bar while tracking is on.",
];

export default function ConsentScreen() {
  const router = useRouter();
  const clockIn = useTrackingStore((s) => s.clockIn);
  const error = useTrackingStore((s) => s.error);
  const [busy, setBusy] = useState(false);

  async function onAgree() {
    setBusy(true);
    await clockIn();
    setBusy(false);
    const err = useTrackingStore.getState().error;
    if (!err) {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>TimeStream</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Before you clock in</Text>
        <Text style={styles.sub}>
          TimeStream shares your location with your employer while you are on
          the clock.
        </Text>
        {BULLETS.map((line) => (
          <View key={line} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.bullet}>{line}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.agree, busy && { opacity: 0.7 }]}
        disabled={busy}
        onPress={onAgree}
      >
        {busy ? (
          <ActivityIndicator color={colors.accentText} />
        ) : (
          <Text style={styles.agreeText}>I agree — clock me in</Text>
        )}
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.notNow}>
        <Text style={styles.notNowText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.screen,
    paddingTop: 64,
    paddingBottom: 40,
  },
  brand: {
    color: colors.text,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 36,
  },
  body: { flex: 1, gap: 14 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sub: { color: colors.text, fontSize: 16, lineHeight: 24, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 7,
  },
  bullet: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 22 },
  agree: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  agreeText: {
    color: colors.accentText,
    fontWeight: "800",
    fontSize: 16,
  },
  notNow: { alignItems: "center", paddingVertical: 18 },
  notNowText: { color: colors.muted, fontSize: 16, fontWeight: "500" },
  error: { color: colors.danger, textAlign: "center", marginBottom: 8 },
});
