/**
 * Emergency.
 *
 * On a phone this screen is genuinely better than its web counterpart: every
 * number here dials on tap, which is the whole point of an emergency contact
 * list someone is looking at during an emergency.
 *
 * The national numbers are constants because they are constants. The society's
 * own contacts come from its settings.
 */
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import { Alert, Btn, Confirm, H4, ListGroup, Section, Tiny } from '../components/ui';
import { useApp } from '../store';
import { useIncidents } from '../data/incidents';
import { colors as c, PAD, radius } from '../theme';

const NATIONAL = [
  { label: 'Emergency (all services)', number: '112', icon: Icons.Alert },
  { label: 'Police', number: '100', icon: Icons.Shield },
  { label: 'Fire', number: '101', icon: Icons.Zap },
  { label: 'Ambulance', number: '108', icon: Icons.Heart },
  { label: 'Women’s helpline', number: '1091', icon: Icons.Phone },
  { label: 'Child helpline', number: '1098', icon: Icons.Baby },
];

export default function Emergency() {
  const nav = useNavigation();
  const { settings, me, can } = useApp();
  const { raise } = useIncidents();
  const [sos, setSos] = useState(false);

  const dial = (n) => Linking.openURL(`tel:${n}`).catch(() => {});

  const society = [
    settings.gateNumber && { label: 'Main gate', number: settings.gateNumber, icon: Icons.Gate },
    settings.managerNumber && { label: 'Society manager', number: settings.managerNumber, icon: Icons.User },
    settings.secretaryNumber && { label: 'Secretary', number: settings.secretaryNumber, icon: Icons.Shield },
  ].filter(Boolean);

  /* Raising an incident is the guard's and committee's; a resident hitting SOS
     dials 112, which is the thing that actually helps them. */
  const canRaise = can('incident.write');

  return (
    <Screen title="Emergency" onBack={() => nav.goBack()}>
      <Alert kind="err" icon={Icons.AlertTri}>
        In a life-threatening emergency call 112 first. Tell the gate afterwards.
      </Alert>

      <Pressable style={s.sosBtn} onPress={() => dial('112')} android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
        <Icons.Sos size={30} color="#fff" />
        <View style={s.grow}>
          <H4 style={s.sosTxt}>Call 112</H4>
          <Tiny style={s.sosSub}>Police, fire and ambulance</Tiny>
        </View>
        <Icons.Phone size={22} color="#fff" />
      </Pressable>

      {society.length ? (
        <>
          <Section title="Your society" />
          <ListGroup>
            {society.map((x) => <CallRow key={x.label} {...x} onPress={() => dial(x.number)} />)}
          </ListGroup>
        </>
      ) : null}

      <Section title="National helplines" />
      <ListGroup>
        {NATIONAL.map((x) => <CallRow key={x.number} {...x} onPress={() => dial(x.number)} />)}
      </ListGroup>

      {canRaise ? (
        <>
          <Section title="Report" />
          <Btn block variant="danger" icon={Icons.AlertTri} onPress={() => setSos(true)}>
            Raise a security incident
          </Btn>
        </>
      ) : null}

      {sos ? (
        <Confirm
          title="Raise a security incident?"
          body="This alerts the committee and puts the incident on the society's register."
          confirmLabel="Raise incident"
          danger
          onConfirm={() => raise({
            type: 'emergency',
            severity: 'high',
            involves: me?.flat ? `Flat ${me.flat}` : me?.name,
            note: 'Raised from the emergency screen',
          })}
          onClose={() => setSos(false)}
        />
      ) : null}
    </Screen>
  );
}

const CallRow = ({ label, number, icon: I, onPress }) => (
  <Pressable style={s.li} onPress={onPress} android_ripple={{ color: c.n100 }}>
    <View style={s.icoTile}><I size={18} color={c.ink4} /></View>
    <View style={s.grow}>
      <H4>{label}</H4>
      <Tiny style={{ marginTop: 2 }}>{number}</Tiny>
    </View>
    <View style={s.call}><Icons.Phone size={16} color={c.accent} /></View>
  </Pressable>
);

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.bad, borderRadius: radius.lg,
    paddingVertical: 18, paddingHorizontal: 17, marginBottom: 6, marginTop: 4,
  },
  sosTxt: { color: '#fff', fontSize: 17, fontWeight: '600' },
  sosSub: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
  call: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
});
