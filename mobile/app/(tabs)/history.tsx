import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import {
  formatHours,
  formatMiles,
} from "../../src/tracking/constants";
import { useTrackingStore } from "../../src/stores/trackingStore";
import type { Shift } from "../../src/types";
import { colors, spacing } from "../../src/theme";

function ShiftRow({ item }: { item: Shift }) {
  const hours =
    item.total_hours != null
      ? Number(item.total_hours)
      : item.live_hours ?? 0;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>
          {new Date(item.clock_in).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </Text>
        <Text style={styles.meta}>
          {new Date(item.clock_in).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" → "}
          {item.clock_out
            ? new Date(item.clock_out).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "open"}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.hours}>{formatHours(hours)}</Text>
        <Text style={styles.miles}>{formatMiles(item.total_miles)}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const history = useTrackingStore((s) => s.history);
  const loadHistory = useTrackingStore((s) => s.loadHistory);
  const error = useTrackingStore((s) => s.error);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setInitialLoading(true);
        await load();
        if (alive) setInitialLoading(false);
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (initialLoading && history.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id || item.client_uuid)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Shift history</Text>
            <Pressable onPress={onRefresh} disabled={refreshing}>
              <Text style={styles.refresh}>
                {refreshing ? "…" : "Refresh"}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No shifts yet. Clock in to start.</Text>
        }
        ListFooterComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        renderItem={({ item }) => <ShiftRow item={item} />}
        contentContainerStyle={{ padding: spacing.screen, gap: 10, flexGrow: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  refresh: { color: colors.accent, fontWeight: "600" },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: { fontWeight: "700", color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  hours: { fontWeight: "700", color: colors.text },
  miles: { color: colors.muted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  error: { color: colors.danger, textAlign: "center", marginTop: 12 },
});
