import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "../src/components/BrandLogo";
import { useThemeColors } from "../src/stores/themeStore";
import { useTrackingStore } from "../src/stores/trackingStore";
import { fonts, spacing, type ThemeColors } from "../src/theme";

const BULLETS = [
  "Tracking starts when you clock in and stops the moment you clock out.",
  "We never track your location when you are off the clock.",
  "Your employer uses this to verify on-site hours and miles traveled — nothing more.",
  "A notification stays in your status bar while tracking is on.",
];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: spacing.screen,
      gap: 8,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontFamily: fonts.headingExtra,
      letterSpacing: -0.4,
      marginBottom: 6,
    },
    sub: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.body,
    },
    row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 7,
    },
    bullet: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: fonts.body,
    },
    actions: {
      marginTop: 20,
      gap: 8,
    },
    agree: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    agreeText: {
      color: colors.accentText,
      fontFamily: fonts.headingExtra,
      fontSize: 16,
    },
    notNow: { alignItems: "center", paddingVertical: 8 },
    notNowText: {
      color: colors.muted,
      fontSize: 16,
      fontFamily: fonts.body,
    },
    error: {
      color: colors.danger,
      textAlign: "center",
      marginBottom: 4,
      fontFamily: fonts.body,
    },
  });
}

export default function ConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 8),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo size={170} />
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          Before you clock in
        </Text>
        <Text style={styles.sub}>
          Forever Culture shares your location with your employer while you are on
          the clock.
        </Text>
        {BULLETS.map((line) => (
          <View key={line} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.bullet}>{line}</Text>
          </View>
        ))}

        <View style={styles.actions}>
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
      </ScrollView>
    </View>
  );
}
