/** Flat register — the society's list of flats, their area and occupancy. */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Badge, Chips, Empty, H4, ListGroup, SearchBar, Section, SkeletonList,
  Stat, StatRow, Tiny,
} from '../../components/ui';
import { useFlats } from '../../data/society';
import { colors as c, PAD } from '../../theme';

export default function FlatRegister() {
  const nav = useNavigation();
  const { flats, loading, refetch } = useFlats();
  const [q, setQ] = useState('');
  const [block, setBlock] = useState('');

  const blocks = useMemo(
    () => [...new Set(flats.map((f) => f.block).filter(Boolean))].sort(),
    [flats],
  );

  const list = useMemo(() => {
    let out = block ? flats.filter((f) => f.block === block) : flats;
    const needle = q.trim().toLowerCase();
    if (needle) out = out.filter((f) => f.code?.toLowerCase().includes(needle));
    return out;
  }, [flats, block, q]);

  const occupied = flats.filter((f) => f.occupancy && f.occupancy !== 'vacant');

  return (
    <Screen
      title="Flat Register"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
    >
      <StatRow>
        <Stat value={flats.length} label="Flats" />
        <Stat value={occupied.length} label="Occupied" divided />
        <Stat value={flats.length - occupied.length} label="Vacant" divided />
      </StatRow>

      <SearchBar value={q} onChange={setQ} placeholder="Search a flat number…" />
      {blocks.length > 1 ? (
        <Chips
          value={block}
          onChange={setBlock}
          options={[{ value: '', label: 'All blocks' }, ...blocks.map((b) => ({ value: b, label: `Block ${b}` }))]}
        />
      ) : null}

      <Section title={`${list.length} flat${list.length === 1 ? '' : 's'}`} />
      {loading && !flats.length ? <SkeletonList rows={8} /> : list.length ? (
        <ListGroup>
          {list.map((f) => (
            <View key={f.id} style={s.li}>
              <View style={s.icoTile}><Icons.Building size={18} color={c.ink4} /></View>
              <View style={s.grow}>
                <H4>{f.code}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[f.type, f.area ? `${f.area} sq ft` : null, f.floor != null ? `Floor ${f.floor}` : null]
                    .filter(Boolean).join(' · ')}
                </Tiny>
              </View>
              <View style={s.right}>
                <Badge color={f.occupancy === 'vacant' ? 'amber' : 'green'}>{f.occupancy || 'unknown'}</Badge>
                {f.parkingSlots ? <Tiny style={{ marginTop: 4 }}>{f.parkingSlots} parking</Tiny> : null}
              </View>
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty icon={Icons.Building} title={q ? `No flat matches "${q}"` : 'No flats on the register'} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
});
