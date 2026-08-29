/**
 * Daily help & staff — maids, cooks, drivers, and who is inside right now.
 *
 * Every helper carries a staff card whose QR the gate scans on the way in and
 * out, which is what makes the "in since" line real rather than self-reported.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Badge, Btn, Empty, ListGroup, Section, Segmented, Sheet, SkeletonList,
  Stat, StatRow, Tiny, H3, H4, Muted,
} from '../components/ui';
import { HelpRow } from '../components/entities';
import { AddHelpSheet } from '../components/sheets';
import QR from '../lib/qr';
import { useApp } from '../store';
import { useHelp } from '../data/help';
import { fmtTime } from '../lib/format';
import { colors as c } from '../theme';

export default function DailyHelp() {
  const nav = useNavigation();
  const { can } = useApp();
  /* Staff and guards see the whole society's register; a resident sees the
     people attached to their own flat. */
  const societyWide = can('gate.view');
  const [scope, setScope] = useState(societyWide ? 'society' : 'mine');
  const { help, loading, add, refetch } = useHelp({ all: scope === 'society' && societyWide });
  const [sheet, setSheet] = useState(false);
  const [card, setCard] = useState(null);

  const inside = help.filter((h) => h.status === 'in');

  return (
    <Screen
      title="Daily Help & Staff"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.Plus} onPress={() => setSheet(true)}>Add</Btn>}
    >
      <StatRow>
        <Stat value={help.length} label="Registered" />
        <Stat value={inside.length} label="Inside now" divided />
        <Stat value={help.filter((h) => h.policeVerified).length} label="Verified" divided />
      </StatRow>

      {societyWide ? (
        <View style={{ marginTop: 10 }}>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[{ value: 'society', label: 'Whole society' }, { value: 'mine', label: 'My flat' }]}
          />
        </View>
      ) : null}

      {inside.length > 0 ? (
        <>
          <Section title="Inside right now" />
          <ListGroup>
            {inside.map((h) => (
              <HelpRow
                key={h.id}
                h={h}
                right={<Badge color="green">Since {fmtTime(h.lastIn)}</Badge>}
                onPress={() => setCard(h)}
              />
            ))}
          </ListGroup>
        </>
      ) : null}

      <Section title="Register" />
      {loading && !help.length ? <SkeletonList rows={5} /> : help.length ? (
        <ListGroup>
          {help.map((h) => <HelpRow key={h.id} h={h} onPress={() => setCard(h)} />)}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Broom}
          title="Nobody registered yet"
          note="Add your maid, cook or driver — they get a staff card the gate scans."
          action={<Btn icon={Icons.Plus} onPress={() => setSheet(true)}>Add daily help</Btn>}
        />
      )}

      {sheet ? <AddHelpSheet onClose={() => setSheet(false)} onAdd={add} /> : null}
      {card ? <StaffCardSheet h={card} onClose={() => setCard(null)} /> : null}
    </Screen>
  );
}

/** The staff card. The QR is what the gate scans; the code under it is the
    fallback when a camera will not focus. */
function StaffCardSheet({ h, onClose }) {
  return (
    <Sheet title={h.name} onClose={onClose}>
      <View style={s.center}>
        <QR value={h.cardCode || h.id} size={178} caption={h.cardCode} />
      </View>
      <View style={{ marginTop: 16 }}>
        <H3>{h.name}</H3>
        <Tiny style={{ marginTop: 3 }}>{[h.role, h.phone].filter(Boolean).join(' · ')}</Tiny>
        <View style={s.wrap}>
          <Badge color={h.status === 'in' ? 'green' : ''}>
            {h.status === 'in' ? `In since ${fmtTime(h.lastIn)}` : 'Outside'}
          </Badge>
          {h.policeVerified ? <Badge>Police verified</Badge> : <Badge color="amber">Not verified</Badge>}
        </View>
        {h.flats?.length ? <Muted style={{ marginTop: 10 }}>Works at {h.flats.join(', ')}</Muted> : null}
      </View>
      <Btn block variant="ghost" onPress={onClose} style={{ marginTop: 16 }}>Close</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
});
