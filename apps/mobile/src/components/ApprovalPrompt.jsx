import React, { useEffect, useRef } from 'react';
import {
  Animated, BackHandler, Easing, Modal, Pressable, StyleSheet, Text, View, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icons from '../icons';
import { Btn, H1, Muted, Tiny, Blink } from './ui';
import { catOf } from './entities';
import { useApprovals } from '../data/approvals';
import { useApp } from '../store';
import { ago } from '../lib/format';
import { colors as c, radius, type } from '../theme';

/**
 * The prompt a resident sees when the gate sends a visitor up for approval.
 *
 * This is deliberately a blocking modal rather than a banner. A guard is
 * standing at the gate with somebody in front of them; a notification the
 * resident can scroll past is how a delivery driver waits ten minutes. It sits
 * above the navigator so it reaches the resident on whichever screen they were
 * already on.
 *
 * There are three ways out and all of them are explicit: approve, deny, or
 * "not now". The Android back button maps to the last of those rather than
 * dismissing silently, because a back press that answered the gate on the
 * resident's behalf would be the worst possible reading of it.
 */
export default function ApprovalPrompt() {
  const approvals = useApprovals();
  const { settings } = useApp();
  const insets = useSafeAreaInsets();
  const visitor = approvals?.current || null;

  const a = useRef(new Animated.Value(0)).current;
  const shownFor = useRef(null);

  useEffect(() => {
    if (!visitor) { a.setValue(0); shownFor.current = null; return; }
    if (shownFor.current === visitor.id) return;

    shownFor.current = visitor.id;
    a.setValue(0);
    Animated.timing(a, {
      toValue: 1, duration: 240, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true,
    }).start();

    /* A short double buzz. The phone may be in a pocket, and this is the one
       screen in the app where somebody is actively waiting on the answer.
       Guarded because it is decoration: a device with no vibrator, or one where
       the VIBRATE permission was stripped by an OEM build, must still get the
       prompt. Losing the approval dialog over a buzz would be absurd. */
    try { Vibration.vibrate([0, 120, 90, 120]); } catch { /* no vibrator */ }
  }, [visitor, a]);

  useEffect(() => {
    if (!visitor) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      approvals.dismiss(visitor);
      return true;
    });
    return () => sub.remove();
  }, [visitor, approvals]);

  if (!visitor) return null;

  const kind = catOf(visitor.category);
  const busy = approvals.busyId === visitor.id;
  const waiting = approvals.queue.length - 1;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={() => approvals.dismiss(visitor)}>
      <View style={s.scrim}>
        <Animated.View
          style={[
            s.card,
            {
              marginBottom: insets.bottom,
              opacity: a,
              transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <View style={s.headRow}>
            <Blink color="amber" />
            <Tiny style={s.headTxt}>AT THE GATE</Tiny>
            <View style={s.grow} />
            <Tiny>{ago(visitor.createdAt)}</Tiny>
          </View>

          <View style={s.who}>
            <View style={s.catTile}><kind.icon size={22} color={c.ink2} /></View>
            <View style={s.grow}>
              <H1 style={s.name} numberOfLines={2}>{visitor.name}</H1>
              <Tiny style={{ marginTop: 4 }}>
                {[kind.label, `Flat ${visitor.flatCode}`, visitor.gateName].filter(Boolean).join(' · ')}
              </Tiny>
            </View>
          </View>

          {visitor.purpose ? <Muted style={s.purpose}>{visitor.purpose}</Muted> : null}

          {visitor.phone || visitor.vehicle ? (
            <View style={s.details}>
              {visitor.phone ? <Detail icon={Icons.Phone} value={visitor.phone} /> : null}
              {visitor.vehicle ? <Detail icon={Icons.Car} value={visitor.vehicle} /> : null}
            </View>
          ) : null}

          <Text style={s.ask}>
            Let them in to {settings.societyName}?
          </Text>

          <View style={s.actions}>
            <Btn
              variant="outline"
              icon={Icons.X}
              style={s.grow}
              disabled={busy}
              onPress={() => approvals.decide(visitor, false)}
            >
              Deny
            </Btn>
            <Btn
              icon={Icons.Check}
              style={s.grow}
              loading={busy}
              onPress={() => approvals.decide(visitor, true)}
            >
              Approve
            </Btn>
          </View>

          <Pressable onPress={() => approvals.dismiss(visitor)} hitSlop={8} style={s.later} disabled={busy}>
            <Text style={s.laterTxt}>
              {waiting > 0 ? `Not now — ${waiting} more waiting` : 'Not now'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const Detail = ({ icon: I, value }) => (
  <View style={s.detail}>
    <I size={14} color={c.ink4} />
    <Tiny>{value}</Tiny>
  </View>
);

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,23,28,0.55)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 16,
    elevation: 24,
    shadowColor: '#14171C',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  headTxt: { color: c.warn, fontWeight: '600', letterSpacing: 0.6, fontSize: 11 },
  who: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  catTile: {
    width: 46, height: 46, borderRadius: radius.lg,
    backgroundColor: c.n100, alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 23, lineHeight: 27, letterSpacing: -0.6 },
  purpose: { marginTop: 12 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ask: { ...type.h4, marginTop: 18, marginBottom: 12, color: c.ink2 },
  actions: { flexDirection: 'row', gap: 10 },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16, marginTop: 2 },
  laterTxt: { ...type.tiny, color: c.ink3, fontWeight: '500' },
});
