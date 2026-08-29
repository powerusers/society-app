/**
 * Sign in.
 *
 * The web login screen carries demo shortcuts for each role; a live deployment
 * must never offer those, and this app is live-only, so they do not exist here
 * at all. What remains is real credentials against /api/auth/login.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import Mark from '../components/Mark';
import { Btn, Card, Input, LinkBtn } from '../components/ui';
import { useApp } from '../store';
import { APP_NAME, APP_TAGLINE } from '../lib/brand';
import { colors as c, radius, type } from '../theme';
import Register from './Register';

export default function Login() {
  const { login } = useApp();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!email.trim() || !pw) return setErr('Enter your email and password');
    setBusy(true);
    const res = await login(email.trim(), pw);
    setBusy(false);
    if (!res.ok) setErr(res.error?.message || 'Could not sign in');
    return undefined;
  };

  if (mode === 'register') return <Register onBack={() => setMode('login')} />;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={c.n800} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.grow}>
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.brand}>
            <View style={s.markBox}><Mark size={30} color="#fff" /></View>
            {/* The platform's name, not a society's. Nobody has a society yet
                at this point. */}
            <Text style={s.appName}>{APP_NAME}</Text>
            <Text style={s.tagline}>{APP_TAGLINE}</Text>
          </View>

          <Card>
            <Text style={[type.h3, { marginBottom: 16 }]}>Sign in</Text>

            <Input
              label="Email"
              value={email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              onChangeText={(v) => { setEmail(v); setErr(''); }}
            />

            <View>
              <Input
                label="Password"
                value={pw}
                placeholder="Enter password"
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                onChangeText={(v) => { setPw(v); setErr(''); }}
                onSubmitEditing={submit}
                returnKeyType="go"
                style={{ paddingRight: 40 }}
              />
              <Pressable
                onPress={() => setShowPw(!showPw)}
                hitSlop={10}
                style={s.eye}
                accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
              >
                <Icons.Eye size={17} color={showPw ? c.accent : c.ink4} />
              </Pressable>
            </View>

            {err ? <Text style={s.err}>{err}</Text> : null}

            <Btn block onPress={submit} loading={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Btn>

            <View style={s.footRow}>
              <Text style={type.muted}>New resident? </Text>
              <LinkBtn onPress={() => setMode('register')}>Register your flat</LinkBtn>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.n800 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 28 },
  markBox: {
    width: 62, height: 62, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  appName: { ...type.h1, color: '#fff' },
  tagline: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6, textAlign: 'center' },
  eye: { position: 'absolute', right: 11, top: 31 },
  err: { fontSize: 12, color: c.bad, marginBottom: 10, fontWeight: '400' },
  footRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, flexWrap: 'wrap' },
});
