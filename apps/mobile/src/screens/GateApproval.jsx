import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Pressable, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import { catOf } from '../components/entities';
import { api, primeTokens } from '../lib/api';
import { closeGateScreen, stopRinging } from '../lib/gate';
import { colors as c, radius, type } from '../theme';

/**
 * The full-screen gate approval, shown over the lock screen.
 *
 * Rendered by GateApprovalActivity, not by the app's navigator — it is its own
 * registered root component with its own props, and it never sees the store, the
 * session provider or the navigation tree. That is deliberate: this screen has
 * to work when the app was not running a second ago, and everything it needs
 * arrives in the notification payload.
 *
 * The one thing it does need from elsewhere is the session, which lives in
 * AsyncStorage. primeTokens() loads it; if the access token has expired the
 * first call 401s and the client refreshes and retries, exactly as anywhere else.
 */
export default function GateApproval(props) {
  return (
    <SafeAreaProvider>
      <Screen {...props} />
    </SafeAreaProvider>
  );
}

function Screen(props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState('asking'); // asking | working | done | gone
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');

  const kind = catOf(props.category);
  const pulse = useRef(new Animated.Value(0)).current;

  /* The session is on disk, not in memory: this may be a cold start. */
  useEffect(() => { primeTokens(); }, []);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  /* The payload says what was true when the guard pressed the button. Somebody
     else in the flat may have answered in the meantime, so confirm before
     showing buttons that would then fail. */
  useEffect(() => {
    if (!props.visitorId) return;
    let alive = true;
    api.get(`/api/visitors?status=pending&limit=20`)
      .then(({ visitors }) => {
        if (!alive) return;
        const still = (visitors || []).some((v) => v.id === props.visitorId);
        if (!still) { setState('gone'); stopRinging(); }
      })
      .catch(() => { /* offline — let them answer anyway; the server decides */ });
    return () => { alive = false; };
  }, [props.visitorId]);

  const answer = useCallback(async (approved) => {
    stopRinging();
    setState('working');
    setError('');
    try {
      await api.patch(`/api/visitors/${props.visitorId}/status`, {
        status: approved ? 'approved' : 'denied',
      });
      setOutcome(approved ? 'approved' : 'denied');
      setState('done');
      /* Long enough to read the confirmation, short enough that nobody is left
         holding a phone waiting for it to go away. */
      setTimeout(closeGateScreen, 1400);
    } catch (err) {
      if (err.status === 409) {
        setState('gone');
        setTimeout(closeGateScreen, 1600);
      } else {
        setError(err.message || 'Could not reach the society server');
        setState('asking');
      }
    }
  }, [props.visitorId]);

  const detail = [kind.label, props.flatCode ? `Flat ${props.flatCode}` : null, props.gateName]
    .filter(Boolean).join(' · ');

  return (
    <View style={[s.root, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 22 }]}>
      <StatusBar barStyle="light-content" backgroundColor={c.n900} translucent={false} />

      <View style={s.top}>
        <Animated.View style={[s.liveDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) }]} />
        <Text style={s.eyebrow}>AT THE GATE</Text>
      </View>

      <View style={s.middle}>
        <View style={s.avatar}><kind.icon size={40} color="#fff" /></View>
        <Text style={s.name} numberOfLines={3}>{props.name || 'A visitor'}</Text>
        {detail ? <Text style={s.detail}>{detail}</Text> : null}
        {props.purpose ? <Text style={s.purpose}>{props.purpose}</Text> : null}

        {props.phone || props.vehicle ? (
          <View style={s.chips}>
            {props.phone ? <Chip icon={Icons.Phone} label={props.phone} /> : null}
            {props.vehicle ? <Chip icon={Icons.Car} label={props.vehicle} /> : null}
          </View>
        ) : null}
      </View>

      <View style={s.bottom}>
        {state === 'gone' ? (
          <>
            <Text style={s.settled}>Already answered</Text>
            <Text style={s.settledSub}>Someone else in your flat dealt with this.</Text>
            <Pressable onPress={closeGateScreen} style={s.dismissBtn}>
              <Text style={s.dismissTxt}>Close</Text>
            </Pressable>
          </>
        ) : state === 'done' ? (
          <>
            <View style={[s.doneBadge, outcome === 'approved' ? s.doneOk : s.doneBad]}>
              {outcome === 'approved'
                ? <Icons.Check size={28} color="#fff" />
                : <Icons.X size={28} color="#fff" />}
            </View>
            <Text style={s.settled}>{outcome === 'approved' ? 'Approved' : 'Denied'}</Text>
            <Text style={s.settledSub}>The guard has been told.</Text>
          </>
        ) : (
          <>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Text style={s.ask}>Let them in?</Text>
            <View style={s.actions}>
              <Answer
                variant="deny"
                icon={Icons.X}
                label="Deny"
                busy={state === 'working'}
                onPress={() => answer(false)}
              />
              <Answer
                variant="approve"
                icon={Icons.Check}
                label="Approve"
                busy={state === 'working'}
                onPress={() => answer(true)}
              />
            </View>
            <Pressable
              onPress={() => { stopRinging(); closeGateScreen(); }}
              style={s.dismissBtn}
              disabled={state === 'working'}
            >
              <Text style={s.dismissTxt}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const Chip = ({ icon: I, label }) => (
  <View style={s.chip}>
    <I size={14} color="rgba(255,255,255,0.6)" />
    <Text style={s.chipTxt}>{label}</Text>
  </View>
);

/** Big, far apart, and unmistakable — this is answered half-awake in the dark. */
const Answer = ({ variant, icon: I, label, onPress, busy }) => (
  <View style={s.answerCol}>
    <Pressable
      onPress={onPress}
      disabled={busy}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 52 }}
      style={({ pressed }) => [
        s.answerBtn,
        variant === 'approve' ? s.approveBtn : s.denyBtn,
        pressed && { opacity: 0.85 },
        busy && { opacity: 0.5 },
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <I size={32} color="#fff" />}
    </Pressable>
    <Text style={s.answerLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.n900, paddingHorizontal: 24, justifyContent: 'space-between' },

  top: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.warn },
  eyebrow: { color: c.warn, fontWeight: '700', fontSize: 12, letterSpacing: 2 },

  middle: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  avatar: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  name: {
    color: '#fff', fontSize: 34, fontWeight: '600',
    letterSpacing: -0.9, lineHeight: 40, textAlign: 'center',
  },
  detail: { color: 'rgba(255,255,255,0.62)', fontSize: 15, marginTop: 10, textAlign: 'center' },
  purpose: { color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 14, textAlign: 'center', lineHeight: 20 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 13,
  },
  chipTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  bottom: { alignItems: 'center' },
  ask: { color: 'rgba(255,255,255,0.75)', fontSize: 16, marginBottom: 22 },
  error: {
    color: '#fff', backgroundColor: c.bad, fontSize: 13,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.md,
    marginBottom: 16, textAlign: 'center', overflow: 'hidden',
  },

  actions: { flexDirection: 'row', gap: 72 },
  answerCol: { alignItems: 'center', gap: 12 },
  answerBtn: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: c.ok },
  denyBtn: { backgroundColor: c.bad },
  answerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },

  dismissBtn: { paddingVertical: 16, paddingHorizontal: 24, marginTop: 12 },
  dismissTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },

  doneBadge: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  doneOk: { backgroundColor: c.ok },
  doneBad: { backgroundColor: c.bad },
  settled: { color: '#fff', fontSize: 22, fontWeight: '600' },
  settledSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6, textAlign: 'center' },
});
