import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../src/stores/trackingStore";
import { colors, spacing } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function initials(user: {
  first_name?: string;
  last_name?: string;
  email?: string;
} | null) {
  if (!user) return "?";
  const first = user.first_name?.trim()?.[0];
  const last = user.last_name?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const local = user.email?.split("@")[0] || "";
  return (local.slice(0, 2) || "?").toUpperCase();
}

function displayName(user: {
  first_name?: string;
  last_name?: string;
  email?: string;
} | null) {
  if (!user) return "Account";
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  return user.email?.split("@")[0] || "Account";
}

function SettingsRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  titleColor,
  onPress,
  showChevron = true,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  titleColor?: string;
  onPress: () => void;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text
          style={[styles.rowTitle, titleColor ? { color: titleColor } : null]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedSoft} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [refreshing, setRefreshing] = useState(false);
  const roleLabel = user?.role === "admin" ? "Admin" : "Employee";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrate();
    setRefreshing(false);
  }, [hydrate]);

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "Your account will be deactivated. This cannot be undone from the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (e) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Could not delete account"
              );
            }
          },
        },
      ]
    );
  }

  if (!user && refreshing) {
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
      <View style={styles.profile}>
        <View style={styles.avatar}>
          {refreshing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.avatarText}>{initials(user)}</Text>
          )}
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{displayName(user)}</Text>
          <Text style={styles.email}>{user?.email || "—"}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="people-outline"
          iconColor={colors.accent}
          iconBg="rgba(245, 158, 11, 0.15)"
          title="View team"
          subtitle="See who's on the clock"
          onPress={() => router.push("/(tabs)/team")}
        />
      </View>

      <Text style={styles.sectionLabel}>Session</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="log-out-outline"
          iconColor={colors.muted}
          iconBg="rgba(148, 163, 184, 0.12)"
          title="Sign out"
          subtitle="End this session on this device"
          onPress={() => logout()}
          showChevron={false}
        />
      </View>

      <Text style={styles.sectionLabel}>Danger zone</Text>
      <View style={[styles.card, styles.dangerCard]}>
        <SettingsRow
          icon="trash-outline"
          iconColor={colors.dangerSoft}
          iconBg="rgba(239, 68, 68, 0.12)"
          title="Delete account"
          subtitle="Deactivate your Forever Culture account"
          titleColor={colors.dangerSoft}
          onPress={confirmDelete}
          showChevron={false}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    paddingBottom: 32,
  },
  centered: { alignItems: "center", justifyContent: "center" },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 28,
    paddingVertical: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "800",
  },
  profileText: { flex: 1, gap: 4 },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  email: {
    color: colors.muted,
    fontSize: 14,
  },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  roleText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionLabel: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  dangerCard: {
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowPressed: { opacity: 0.72 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
});
