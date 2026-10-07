import { Platform, StyleSheet, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "../../src/components/BrandLogo";
import { colors } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_CONTENT_HEIGHT = 52;

function tabIcon(outline: IconName, filled: IconName) {
  return ({
    focused,
    color,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) => (
    <Ionicons
      name={focused ? filled : outline}
      size={focused ? 26 : 24}
      color={typeof color === "string" ? color : colors.mutedSoft}
    />
  );
}

function HeaderLogo() {
  return <BrandLogo size={56} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 48)
      : Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleAlign: "center",
        headerTitle: HeaderLogo,
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: "rgba(51, 65, 85, 0.55)",
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
          height: TAB_CONTENT_HEIGHT + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedSoft,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: tabIcon("time-outline", "time"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: tabIcon("list-outline", "list"),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: tabIcon("people-outline", "people"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: tabIcon("settings-outline", "settings"),
        }}
      />
    </Tabs>
  );
}
