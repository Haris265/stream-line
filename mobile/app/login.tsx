import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BrandLogo } from "../src/components/BrandLogo";
import { useThemeColors } from "../src/stores/themeStore";
import { useAuthStore } from "../src/stores/trackingStore";
import { fonts, spacing, type ThemeColors } from "../src/theme";

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.screen,
      paddingTop: 48,
      paddingBottom: 32,
      gap: 8,
    },
    sub: {
      color: colors.muted,
      textAlign: "center",
      marginBottom: 8,
      fontSize: 16,
      fontFamily: fonts.body,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      fontFamily: fonts.body,
    },
    button: {
      marginTop: 4,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: {
      color: colors.accentText,
      fontFamily: fonts.headingExtra,
      fontSize: 17,
    },
    forgotWrap: { alignItems: "center", paddingVertical: 4 },
    forgot: { color: colors.accent, fontFamily: fonts.heading, fontSize: 15 },
    help: {
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 4,
      fontSize: 13,
      fontFamily: fonts.body,
    },
    error: {
      color: colors.danger,
      textAlign: "center",
      fontFamily: fonts.body,
    },
  });
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function onForgot() {
    Alert.alert(
      "Forgot password?",
      "Contact your employer to reset your Forever Culture password."
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      keyboardVerticalOffset={12}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <BrandLogo size={220} />
        <Text style={styles.sub}>Employee time clock</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable onPress={onForgot} style={styles.forgotWrap}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </Pressable>

        <Text style={styles.help}>
          Your employer invites you to Forever Culture. Use the email and password
          you set when you accepted the invite.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
