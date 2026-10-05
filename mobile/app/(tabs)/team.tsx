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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "../../src/api/client";
import {
  formatHours,
  formatMiles,
} from "../../src/tracking/constants";
import type { LiveStatus } from "../../src/types";
import { useAuthStore } from "../../src/stores/trackingStore";
import { colors, spacing } from "../../src/theme";

export default function TeamScreen() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<LiveStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.liveStatus();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setBusy(true);
        setInitialLoading(true);
        await load();
        if (alive) {
          setBusy(false);
          setInitialLoading(false);
        }
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

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const csv = await api.exportCsv();
      const dir = FileSystem.cacheDirectory;
      if (!dir) throw new Error("Cache directory unavailable");
      const path = `${dir}timesheets.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export timesheets",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (initialLoading && rows.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, (busy || refreshing) && { opacity: 0.7 }]}
          onPress={onRefresh}
          disabled={busy || refreshing}
        >
          {busy || refreshing ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.btnText}>Refresh</Text>
          )}
        </Pressable>
        {isAdmin ? (
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={exportCsv}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.btnText, { color: colors.accent }]}>
                Export CSV
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.shift_id)}
        contentContainerStyle={{ padding: spacing.screen, gap: 10, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <Text style={styles.title}>{"Who's on the clock"}</Text>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No one is on the clock right now.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.email}>{item.first_name || item.email}</Text>
            <Text style={styles.meta}>
              {item.is_on_break ? "On a break · " : ""}
              {formatHours(item.live_hours)} · {formatMiles(item.total_miles)}
            </Text>
            <Text style={styles.meta}>
              In since {new Date(item.clock_in).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: spacing.screen,
    paddingBottom: 0,
  },
  btn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnText: { color: colors.accentText, fontWeight: "700" },
  title: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  email: { fontWeight: "700", color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginHorizontal: 16,
    marginTop: 8,
  },
});
