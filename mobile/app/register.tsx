import { Link } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
    row: {
      flexDirection: "row",
      gap: 8,
    },
    half: {
      flex: 1,
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
    linkWrap: { alignItems: "center", paddingVertical: 8 },
    link: { color: colors.accent, fontFamily: fonts.heading, fontSize: 15 },
    error: {
      color: colors.danger,
      textAlign: "center",
      fontFamily: fonts.body,
    },
  });
}

export default function RegisterScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const register = useAuthStore((s) => s.register);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
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
        <Text style={styles.sub}>Create your employee account</Text>

        <View style={styles.row}>
          <TextInput
            placeholder="First name"
            placeholderTextColor={colors.mutedSoft}
            style={[styles.input, styles.half]}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            placeholder="Last name"
            placeholderTextColor={colors.mutedSoft}
            style={[styles.input, styles.half]}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>

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
          keyboardType="phone-pad"
          placeholder="Phone (optional)"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          secureTextEntry
          placeholder="Confirm password"
          placeholderTextColor={colors.mutedSoft}
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/login" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
