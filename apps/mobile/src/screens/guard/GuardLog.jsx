/** Gate log — everything that came through the gate, newest first. */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Badge, Chips, Empty, H4, ListGroup, SearchBar, SkeletonList, Tiny,
} from '../../components/ui';
import { CatTile, STATUS_COLOR } from '../../components/entities';
import { useVisitors } from '../../data/visitors';
import { fmtDateTime, fmtTime, minsBetween } from '../../lib/format';
import { colors as c, PAD } from '../../theme';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'inside', label: 'Inside' },
  { value: 'exited', label: 'Exited' },
  { value: 'denied', label: 'Denied' },
];

export default function GuardLog() {
  const nav = useNavigation();
  const { visitors, loading, refetch } = useVisitors();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    let out = filter === 'all' ? visitors : visitors.filter((v) => v.status === filter);
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((v) => (
        v.name?.toLowerCase().includes(needle) || v.flatCode?.toLowerCase().includes(needle)
      ));
    }
    return out;
  }, [visitors, filter, q]);

  return (
    <Screen
      title="Gate Log"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
    >
      <SearchBar value={q} onChange={setQ} placeholder="Search a name or flat…" />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />

      {loading && !visitors.length ? <SkeletonList rows={8} /> : list.length ? (
        <ListGroup>
          {list.map((v) => (
            <View key={v.id} style={s.li}>
              <CatTile category={v.category} />
              <View style={s.grow}>
                <H4 numberOfLines={1}>{v.name}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[`Flat ${v.flatCode}`, v.gateName, v.purpose].filter(Boolean).join(' · ')}
                </Tiny>
                <Tiny style={{ marginTop: 2 }}>
                  {v.entryAt ? `In ${fmtTime(v.entryAt)}` : fmtDateTime(v.createdAt)}
                  {v.exitAt ? ` · out ${fmtTime(v.exitAt)} · stayed ${minsBetween(v.entryAt, v.exitAt)}m` : ''}
                </Tiny>
              </View>
              <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty icon={Icons.Clock} title="Nothing logged" note="Every entry and exit through the gate is recorded here." />
      )}
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
});
