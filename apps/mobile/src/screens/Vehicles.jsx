/** Vehicles & parking. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Badge, Btn, Confirm, Empty, H4, ListGroup, Mono, SearchBar, Section,
  SkeletonList, Stat, StatRow, Tiny,
} from '../components/ui';
import { AddVehicleSheet } from '../components/sheets';
import { useApp } from '../store';
import { useVehicles } from '../data/vehicles';
import { Pressable } from 'react-native';
import { colors as c, PAD } from '../theme';

const KIND_ICON = { Car: Icons.Car, Bike: Icons.Car, EV: Icons.Zap };

export default function Vehicles() {
  const nav = useNavigation();
  const { can } = useApp();
  const societyWide = can('gate.view');
  const { vehicles, loading, add, remove, refetch } = useVehicles({ all: societyWide });
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [q, setQ] = useState('');

  const list = q.trim()
    ? vehicles.filter((v) => (
      v.number?.toLowerCase().includes(q.trim().toLowerCase())
        || v.flatCode?.toLowerCase().includes(q.trim().toLowerCase())
    ))
    : vehicles;

  return (
    <Screen
      title="Vehicles & Parking"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.Plus} onPress={() => setSheet(true)}>Add</Btn>}
    >
      <StatRow>
        <Stat value={vehicles.length} label="Registered" />
        <Stat value={vehicles.filter((v) => v.kind === 'Car').length} label="Cars" divided />
        <Stat value={vehicles.filter((v) => v.kind === 'EV').length} label="EVs" divided />
      </StatRow>

      {societyWide ? <SearchBar value={q} onChange={setQ} placeholder="Search a plate or flat…" /> : null}

      <Section title={societyWide ? 'All vehicles' : 'Your vehicles'} />
      {loading && !vehicles.length ? <SkeletonList rows={4} /> : list.length ? (
        <ListGroup>
          {list.map((v) => {
            const I = KIND_ICON[v.kind] || Icons.Car;
            return (
              <Pressable
                key={v.id}
                style={s.li}
                android_ripple={{ color: c.n100 }}
                onLongPress={() => setConfirm(v)}
              >
                <View style={s.icoTile}><I size={18} color={c.ink4} /></View>
                <View style={s.grow}>
                  <Mono style={s.plate}>{v.number}</Mono>
                  <Tiny style={{ marginTop: 3 }}>
                    {[v.model, v.flatCode ? `Flat ${v.flatCode}` : null].filter(Boolean).join(' · ')}
                  </Tiny>
                </View>
                {v.slot ? <Badge>Slot {v.slot}</Badge> : <Badge color="amber">No slot</Badge>}
              </Pressable>
            );
          })}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Car}
          title={q ? `No vehicle matches "${q}"` : 'No vehicles registered'}
          note="Registering a vehicle lets the gate match it to your flat automatically."
          action={<Btn icon={Icons.Plus} onPress={() => setSheet(true)}>Register a vehicle</Btn>}
        />
      )}

      {sheet ? <AddVehicleSheet onClose={() => setSheet(false)} onAdd={add} /> : null}
      {confirm ? (
        <Confirm
          title="Remove vehicle?"
          body={`${confirm.number} will no longer be recognised at the gate.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => remove(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  plate: { fontSize: 14, fontWeight: '700', letterSpacing: 1, color: c.ink },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
});
