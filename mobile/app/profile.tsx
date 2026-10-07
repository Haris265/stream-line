import { useMemo } from "react";
import { Stack } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "../src/stores/themeStore";
import { useAuthStore } from "../src/stores/trackingStore";
import { fonts, spacing, type ThemeColors } from "../src/theme";

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
      fontFamily: fonts.heading,
    },
    rowSubtitle: {
      color: colors.muted,
      fontSize: 12,
      fontFamily: fonts.body,
    },
  });
}

function ProfileRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  titleColor,
  onPress,
  styles,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  titleColor?: string;
  onPress: () => void;
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
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const roleLabel = user?.role === "admin" ? "Admin" : "Employee";

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

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Profile",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{displayName(user)}</Text>
            <Text style={styles.email}>{user?.email || "—"}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Danger zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <ProfileRow
            styles={styles}
            icon="trash-outline"
            iconColor={colors.dangerSoft}
            iconBg={colors.iconDangerBg}
            title="Delete account"
            subtitle="Deactivate your Forever Culture account"
            titleColor={colors.dangerSoft}
            onPress={confirmDelete}
          />
        </View>
      </ScrollView>
    </View>
  );
}
