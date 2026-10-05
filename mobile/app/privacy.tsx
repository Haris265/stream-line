import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../src/theme";

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Privacy Policy",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>TimeStream Privacy</Text>
        <Text style={styles.body}>
          TimeStream only shares your location with your employer while you are
          on the clock.
        </Text>
        <Text style={styles.bullet}>
          • Tracking starts when you clock in and stops the moment you clock
          out.
        </Text>
        <Text style={styles.bullet}>
          • We never track your location when you are off the clock.
        </Text>
        <Text style={styles.bullet}>
          • Your employer uses this to verify on-site hours and mileage — nothing
          more.
        </Text>
        <Text style={styles.bullet}>
          • A notification stays in your status bar while tracking is on.
        </Text>
        <Text style={styles.body}>
          You can request that your account and related data be deleted from the
          app (Delete account).
        </Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.screen, gap: 14, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  bullet: { color: colors.text, fontSize: 15, lineHeight: 22 },
  back: { marginTop: 20, alignItems: "center" },
  backText: { color: colors.accent, fontWeight: "700", fontSize: 16 },
});
