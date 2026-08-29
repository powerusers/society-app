/**
 * Visitors & Gate — the resident's side of the gate.
 *
 * Nothing enters without the resident's yes or a valid pre-approved pass. This
 * screen is where the yes is given and where the pass is issued.
 */
import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Btn, Chips, Empty, ListGroup, Section, SkeletonList, Tiny, H4,
} from '../components/ui';
import { ApproveDeny, VisitorCard, CatTile, STATUS_COLOR } from '../components/entities';
import { PreApproveSheet, GatePassSheet } from '../components/sheets';
import { useApp } from '../store';
import { useVisitors } from '../data/visitors';
import { ago, fmtTime } from '../lib/format';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors as c, PAD } from '../theme';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'expected', label: 'Expected' },
  { value: 'inside', label: 'Inside' },
  { value: 'past', label: 'Past' },
];

export default function Visitors() {
  const { me, can } = useApp();
  const nav = useNavigation();
  const { visitors, loading, transition, refetch } = useVisitors();
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null);
  const [pass, setPass] = useState(null);

  const pending = visitors.filter((v) => v.status === 'pending' && v.flatCode === me?.flat);

  const list = useMemo(() => {
    if (filter === 'expected') return visitors.filter((v) => v.status === 'pre-approved' || v.status === 'approved');
    if (filter === 'inside') return visitors.filter((v) => v.status === 'inside');
    if (filter === 'past') return visitors.filter((v) => v.status === 'exited' || v.status === 'denied');
    return visitors;
  }, [visitors, filter]);

  return (
    <Screen
      title="Visitors & Gate"
      sub={can('gate.view') ? 'Whole society' : `Flat ${me?.flat || '—'}`}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.UserPlus} onPress={() => setSheet('pre')}>Pre-approve</Btn>}
    >
      {pending.length > 0 ? (
        <>
          <Alert kind="warn" icon={Icons.Bell}>
            {pending.length} visitor{pending.length > 1 ? 's are' : ' is'} waiting for your approval.
          </Alert>
          {pending.map((v) => (
            <VisitorCard
              key={v.id}
              v={v}
              actions={(
                <ApproveDeny
                  onApprove={() => transition(v, 'approved')}
                  onDeny={() => transition(v, 'denied')}
                />
              )}
            />
          ))}
        </>
      ) : null}

      <Section title="Gate activity" />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />

      {loading ? <SkeletonList rows={5} /> : list.length ? (
        <ListGroup>
          {list.map((v) => (
            <Pressable
              key={v.id}
              style={s.li}
              android_ripple={{ color: c.n100 }}
              onPress={v.passCode ? () => setPass(v) : undefined}
            >
              <CatTile category={v.category} />
              <View style={s.grow}>
                <H4 numberOfLines={1}>{v.name}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[`Flat ${v.flatCode}`, v.gateName, v.purpose].filter(Boolean).join(' · ')}
                </Tiny>
                <Tiny style={{ marginTop: 2 }}>
                  {v.status === 'inside' && v.entryAt ? `In at ${fmtTime(v.entryAt)}` : ago(v.createdAt)}
                </Tiny>
              </View>
              <View style={s.right}>
                <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
                {v.passCode ? <Tiny style={{ marginTop: 4 }}>Pass {v.passCode}</Tiny> : null}
              </View>
            </Pressable>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Gate}
          title="Nothing here yet"
          note="Visitors approved at the gate, and passes you issue, appear here."
          action={<Btn icon={Icons.UserPlus} onPress={() => setSheet('pre')}>Pre-approve a visitor</Btn>}
        />
      )}

      {sheet === 'pre' ? <PreApproveSheet onClose={() => setSheet(null)} /> : null}
      {pass ? <GatePassSheet visitor={pass} onClose={() => setPass(null)} /> : null}
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
});
