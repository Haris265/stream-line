import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";

import { useAuthStore } from "../src/stores/trackingStore";
import { colors, spacing } from "../src/theme";

export default function LoginScreen() {
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
      "Contact your employer to reset your TimeStream password."
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>TimeStream</Text>
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
          Your employer invites you to TimeStream. Use the email and password
          you set when you accepted the invite.
        </Text>

        <Link href="/privacy" style={styles.privacy}>
          Privacy Policy
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
  },
  inner: {
    paddingHorizontal: spacing.screen,
    gap: 12,
  },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  sub: {
    color: colors.muted,
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
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
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: colors.accentText,
    fontWeight: "800",
    fontSize: 17,
  },
  forgotWrap: { alignItems: "center", paddingVertical: 4 },
  forgot: { color: colors.accent, fontWeight: "600", fontSize: 15 },
  help: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    fontSize: 13,
  },
  privacy: {
    marginTop: 28,
    textAlign: "center",
    color: colors.privacyLink,
    textDecorationLine: "underline",
    fontSize: 14,
  },
  error: { color: colors.danger, textAlign: "center" },
});
