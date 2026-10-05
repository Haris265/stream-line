import { useCallback, useEffect, useState } from "react";
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

import { formatHours } from "../../src/tracking/constants";
import {
  useAuthStore,
  useTrackingStore,
} from "../../src/stores/trackingStore";
import { colors, spacing } from "../../src/theme";

function displayName(user: {
  first_name?: string;
  email?: string;
} | null) {
  if (!user) return "there";
  if (user.first_name?.trim()) return user.first_name.trim();
  const local = user.email?.split("@")[0];
  return local || "there";
}

export default function ClockScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    currentShift,
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
          <Text style={styles.timer}>{formatHours(liveHours)}</Text>
          <Text style={styles.thisShift}>this shift</Text>
          {onBreak ? (
            <Text style={styles.breakTimer}>
              Break · {formatHours(breakHours)}
            </Text>
          ) : null}

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 24,
  },
  centered: { alignItems: "center", justifyContent: "center" },
  top: { gap: 10 },
  hello: { color: colors.muted, fontSize: 18, fontWeight: "500" },
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
  badgeText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  offShiftBlock: { flexGrow: 1, paddingTop: 28 },
  clockInBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  clockInText: {
    color: colors.accentText,
    fontWeight: "800",
    fontSize: 18,
  },
  onShiftBlock: {
    flexGrow: 1,
    paddingTop: 28,
    gap: 10,
  },
  timer: {
    color: colors.text,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
  },
  thisShift: { color: colors.muted, fontSize: 15, marginBottom: 4 },
  breakTimer: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  clockOutBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  clockOutText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  breakBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  breakText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  locationNote: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
  error: { color: colors.danger, textAlign: "center", marginTop: 12 },
});
