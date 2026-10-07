import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { formatHours, formatMiles } from "../../src/tracking/constants";
import { useThemeColors } from "../../src/stores/themeStore";
import {
  useAuthStore,
  useTrackingStore,
} from "../../src/stores/trackingStore";
import { fonts, spacing, type ThemeColors } from "../../src/theme";

function displayName(user: {
  first_name?: string;
  email?: string;
} | null) {
  if (!user) return "there";
  if (user.first_name?.trim()) return user.first_name.trim();
  const local = user.email?.split("@")[0];
  return local || "there";
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.screen,
      paddingTop: 12,
      paddingBottom: 28,
    },
    centered: { alignItems: "center", justifyContent: "center" },
    top: { gap: 10, marginBottom: 8 },
    hello: {
      color: colors.muted,
      fontSize: 18,
      fontFamily: fonts.body,
    },
    badge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    badgeOn: { backgroundColor: colors.onClockBg },
    badgeOff: {
      backgroundColor: colors.offClockBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badgeDot: { width: 8, height: 8, borderRadius: 4 },
    badgeText: {
      color: colors.text,
      fontFamily: fonts.heading,
      fontSize: 13,
    },
    offShiftBlock: { flexGrow: 1, paddingTop: 28 },
    clockInBtn: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: "center",
    },
    clockInText: {
      color: colors.accentText,
      fontFamily: fonts.headingExtra,
      fontSize: 18,
    },
    onShiftBlock: {
      flexGrow: 1,
      paddingTop: 20,
      gap: 14,
    },
    timerBlock: {
      gap: 4,
      marginBottom: 8,
    },
    timer: {
      color: colors.text,
      fontSize: 42,
      lineHeight: 50,
      fontFamily: fonts.heading,
      letterSpacing: -1,
    },
    thisShift: {
      color: colors.muted,
      fontSize: 15,
      fontFamily: fonts.body,
    },
    breakTimer: {
      color: colors.accent,
      fontSize: 16,
      fontFamily: fonts.heading,
      marginTop: 4,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 4,
    },
    statLabel: {
      color: colors.muted,
      fontSize: 12,
      fontFamily: fonts.body,
    },
    statValue: {
      color: colors.text,
      fontSize: 18,
      fontFamily: fonts.heading,
    },
    actions: {
      gap: 12,
      marginTop: 8,
    },
    clockOutBtn: {
      backgroundColor: colors.danger,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: "center",
    },
    clockOutText: {
      color: "#fff",
      fontFamily: fonts.headingExtra,
      fontSize: 17,
    },
    breakBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    breakText: {
      color: colors.accent,
      fontFamily: fonts.heading,
      fontSize: 16,
    },
    locationNote: {
      color: colors.muted,
      textAlign: "center",
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: fonts.body,
    },
    error: {
      color: colors.danger,
      textAlign: "center",
      marginTop: 12,
      fontFamily: fonts.body,
    },
  });
}

export default function ClockScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const {
    currentShift,
    localMiles,
    busy,
    error,
    clockOut,
    startBreak,
    endBreak,
    refreshCurrent,
  } = useTrackingStore();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    await refreshCurrent();
  }, [refreshCurrent]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setInitialLoading(true);
      await load();
      if (alive) setInitialLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (!currentShift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [currentShift]);

  void tick;

  const onShift = Boolean(currentShift);
  const onBreak = Boolean(currentShift?.is_on_break);

  const liveHours = (() => {
    if (!currentShift) return 0;
    const start = new Date(currentShift.clock_in).getTime();
    if (Number.isNaN(start)) return 0;
    let breakMs = Number(currentShift.total_break_minutes || 0) * 60_000;
    if (currentShift.is_on_break && currentShift.break_started_at) {
      const breakStart = new Date(currentShift.break_started_at).getTime();
      if (!Number.isNaN(breakStart)) {
        breakMs += Date.now() - breakStart;
      }
    }
    return Math.max(0, (Date.now() - start - breakMs) / 3_600_000);
  })();

  const breakHours = (() => {
    if (!currentShift?.is_on_break || !currentShift.break_started_at) return 0;
    const breakStart = new Date(currentShift.break_started_at).getTime();
    if (Number.isNaN(breakStart)) return 0;
    return Math.max(0, (Date.now() - breakStart) / 3_600_000);
  })();

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (initialLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={styles.top}>
        <Text style={styles.hello}>Hi, {displayName(user)}</Text>
        <View
          style={[styles.badge, onShift ? styles.badgeOn : styles.badgeOff]}
        >
          <View
            style={[
              styles.badgeDot,
              {
                backgroundColor: onShift
                  ? colors.onClockDot
                  : colors.offClockDot,
              },
            ]}
          />
          <Text style={styles.badgeText}>
            {onShift
              ? onBreak
                ? "On a break"
                : "On the clock"
              : "Clocked out"}
          </Text>
        </View>
      </View>

      {onShift ? (
        <View style={styles.onShiftBlock}>
          <View style={styles.timerBlock}>
            <Text
              style={styles.timer}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {formatHours(liveHours)}
            </Text>
            <Text style={styles.thisShift}>this shift</Text>
            {onBreak ? (
              <Text style={styles.breakTimer}>
                Break · {formatHours(breakHours)}
              </Text>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Hours</Text>
              <Text style={styles.statValue}>{formatHours(liveHours)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Miles</Text>
              <Text style={styles.statValue}>{formatMiles(localMiles)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.clockOutBtn, busy && { opacity: 0.7 }]}
              disabled={busy}
              onPress={() => clockOut()}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.clockOutText}>Clock out</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.breakBtn, busy && { opacity: 0.7 }]}
              disabled={busy}
              onPress={() => (onBreak ? endBreak() : startBreak())}
            >
              <Text style={styles.breakText}>
                {onBreak ? "End break" : "Take a break"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.locationNote}>
            {onBreak
              ? "Location sharing paused while you are on break."
              : "Location sharing is on until you clock out."}
          </Text>
        </View>
      ) : (
        <View style={styles.offShiftBlock}>
          <Pressable
            style={[styles.clockInBtn, busy && { opacity: 0.7 }]}
            disabled={busy}
            onPress={() => router.push("/consent")}
          >
            <Text style={styles.clockInText}>Clock in</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}
