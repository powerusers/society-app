/**
 * Prangan — society management for Android.
 *
 * The React Native client for the same API the web app talks to. Authorisation,
 * bill calculation and request schemas come from @gvs/shared, unchanged and
 * shared with the server, so the rules cannot drift between the three clients.
 */
import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/store';
import { ApprovalProvider } from './src/data/approvals';
import ApprovalPrompt from './src/components/ApprovalPrompt';
import { Toast } from './src/components/ui';
import Mark from './src/components/Mark';
import Login from './src/screens/Login';
import Navigation from './src/navigation';
import { colors as c, type } from './src/theme';
import { APP_NAME } from './src/lib/brand';

/**
 * Cold start shows the mark rather than a bare spinner: resuming a session is a
 * round trip to the server, and on a slow connection a blank screen reads as a
 * crash.
 */
function Splash() {
  return (
    <View style={s.splash}>
      <StatusBar barStyle="light-content" backgroundColor={c.n800} />
      <Mark size={46} color="#fff" />
      <Text style={s.splashName}>{APP_NAME}</Text>
      <ActivityIndicator color="rgba(255,255,255,0.5)" style={{ marginTop: 22 }} />
    </View>
  );
}

function Root() {
  const { booting, authed, toast, setToast } = useApp();

  return (
    <View style={s.root}>
      {booting ? <Splash /> : authed ? <Navigation /> : <Login />}
      {/* Above the navigator, so a visitor sent up by the gate reaches the
          resident on whichever screen they happen to be on. */}
      <ApprovalPrompt />
      {/* Above that again: a toast raised on one screen survives a push, and a
          decision made in the prompt is confirmed over it. */}
      <Toast toast={toast} onHide={() => setToast(null)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ApprovalProvider>
          <Root />
        </ApprovalProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },
  splash: { flex: 1, backgroundColor: c.n800, alignItems: 'center', justifyContent: 'center' },
  splashName: { ...type.h1, color: '#fff', marginTop: 18 },
});
