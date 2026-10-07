import { useCallback, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors, useThemeStore } from "../../src/stores/themeStore";
import { useAuthStore } from "../../src/stores/trackingStore";
import {
  fonts,
  spacing,
  type ThemeColors,
  type ThemeMode,
} from "../../src/theme";

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
  trailing,
  colors,
  styles,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  titleColor?: string;
  onPress: () => void;
  showChevron?: boolean;
  trailing?: React.ReactNode;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
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
      {trailing}
      {showChevron && !trailing ? (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedSoft} />
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      fontSize: 18,
      fontFamily: fonts.heading,
      textAlign: "center",
      lineHeight: 22,
      includeFontPadding: false,
    },
    profileText: { flex: 1, gap: 4 },
    name: {
      color: colors.text,
      fontSize: 20,
      fontFamily: fonts.headingExtra,
    },
    email: {
      color: colors.muted,
      fontSize: 14,
      fontFamily: fonts.body,
    },
    rolePill: {
      alignSelf: "flex-start",
      marginTop: 4,
      backgroundColor: colors.iconAccentBg,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    roleText: {
      color: colors.accent,
      fontSize: 12,
      fontFamily: fonts.heading,
    },
    sectionLabel: {
      color: colors.mutedSoft,
      fontSize: 12,
      fontFamily: fonts.heading,
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
      fontFamily: fonts.heading,
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 12,
      fontFamily: fonts.body,
    },
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const [refreshing, setRefreshing] = useState(false);
  const roleLabel = user?.role === "admin" ? "Admin" : "Employee";
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrate();
    setRefreshing(false);
  }, [hydrate]);

  function selectMode(next: ThemeMode) {
    void setMode(next);
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
          colors={colors}
          styles={styles}
          icon="person-outline"
          iconColor={colors.accent}
          iconBg={colors.iconAccentBg}
          title="Profile settings"
          subtitle="Account details and deletion"
          onPress={() => router.push("/profile")}
        />
        <SettingsRow
          colors={colors}
          styles={styles}
          icon="people-outline"
          iconColor={colors.accent}
          iconBg={colors.iconAccentBg}
          title="View team"
          subtitle="See who's on the clock"
          onPress={() => router.push("/(tabs)/team")}
        />
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.card}>
        <SettingsRow
          colors={colors}
          styles={styles}
          icon="moon-outline"
          iconColor={colors.accent}
          iconBg={colors.iconAccentBg}
          title="Dark"
          subtitle="Current app look"
          showChevron={false}
          onPress={() => selectMode("dark")}
          trailing={
            mode === "dark" ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null
          }
        />
        <SettingsRow
          colors={colors}
          styles={styles}
          icon="sunny-outline"
          iconColor={colors.accent}
          iconBg={colors.iconAccentBg}
          title="Light"
          subtitle="Bright backgrounds"
          showChevron={false}
          onPress={() => selectMode("light")}
          trailing={
            mode === "light" ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null
          }
        />
      </View>

      <Text style={styles.sectionLabel}>Session</Text>
      <View style={styles.card}>
        <SettingsRow
          colors={colors}
          styles={styles}
          icon="log-out-outline"
          iconColor={colors.muted}
          iconBg={colors.iconMutedBg}
          title="Sign out"
          subtitle="End this session on this device"
          onPress={() => logout()}
          showChevron={false}
        />
      </View>
    </ScrollView>
  );
}
