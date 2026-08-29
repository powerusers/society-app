/** Society staff — the people the society itself employs, and their attendance. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Badge, Btn, Empty, ListGroup, Section, SearchBar, SkeletonList, Stat,
  StatRow, Tiny,
} from '../../components/ui';
import { HelpRow } from '../../components/entities';
import { AddHelpSheet } from '../../components/sheets';
import { useHelp, useAttendance } from '../../data/help';
import { fmtDateTime } from '../../lib/format';
import { colors as c, PAD } from '../../theme';
import { H4 } from '../../components/ui';

export default function StaffMgmt() {
  const nav = useNavigation();
  const { help, loading, add, refetch } = useHelp({ all: true });
  const { attendance } = useAttendance();
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');

  const list = q.trim()
    ? help.filter((h) => h.name?.toLowerCase().includes(q.trim().toLowerCase()))
    : help;
  const inside = help.filter((h) => h.status === 'in');

  return (
    <Screen
      title="Society Staff"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.Plus} onPress={() => setSheet(true)}>Add</Btn>}
    >
      <StatRow>
        <Stat value={help.length} label="On register" />
        <Stat value={inside.length} label="On duty" divided />
        <Stat value={help.filter((h) => !h.policeVerified).length} label="Unverified" divided />
      </StatRow>

      <SearchBar value={q} onChange={setQ} placeholder="Search staff…" />

      <Section title="Register" />
      {loading && !help.length ? <SkeletonList rows={6} /> : list.length ? (
        <ListGroup>{list.map((h) => <HelpRow key={h.id} h={h} />)}</ListGroup>
      ) : (
        <Empty icon={Icons.Tools} title={q ? `Nobody matches "${q}"` : 'No staff on the register'} />
      )}

      {attendance.length > 0 ? (
        <>
          <Section title="Recent attendance" />
          <ListGroup>
            {attendance.slice(0, 20).map((a) => (
              <View key={a.id} style={s.li}>
                <View style={s.icoTile}>
                  <Icons.Finger size={18} color={a.direction === 'in' ? c.ok : c.ink4} />
                </View>
                <View style={s.grow}>
                  <H4>{a.name}</H4>
                  <Tiny style={{ marginTop: 2 }}>{fmtDateTime(a.at)}</Tiny>
                </View>
                <Badge color={a.direction === 'in' ? 'green' : ''}>{a.direction}</Badge>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}

      {sheet ? <AddHelpSheet onClose={() => setSheet(false)} onAdd={add} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
});
