/**
 * Audit trail.
 *
 * Every write the API accepts is recorded server-side; this is that record. It
 * is deliberately read-only — an audit trail an administrator can edit is not
 * an audit trail.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Badge, Empty, H4, ListGroup, SearchBar, SkeletonList, Tiny,
} from '../../components/ui';
import { useAudit } from '../../data/directory';
import { fmtDateTime } from '../../lib/format';
import { colors as c, PAD } from '../../theme';

export default function Audit() {
  const nav = useNavigation();
  const { audit, loading, refetch } = useAudit();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return audit;
    return audit.filter((a) => (
      a.action?.toLowerCase().includes(needle)
      || a.actorName?.toLowerCase().includes(needle)
      || a.entity?.toLowerCase().includes(needle)
    ));
  }, [audit, q]);

  return (
    <Screen
      title="Audit Trail"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
    >
      <SearchBar value={q} onChange={setQ} placeholder="Search an action or person…" />

      {loading && !audit.length ? <SkeletonList rows={8} /> : list.length ? (
        <ListGroup>
          {list.map((a) => (
            <View key={a.id} style={s.li}>
              <View style={s.icoTile}><Icons.Book size={17} color={c.ink4} /></View>
              <View style={s.grow}>
                <H4>{a.action}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[a.actorName, a.entity].filter(Boolean).join(' · ')}
                </Tiny>
                {a.detail ? <Tiny style={{ marginTop: 2 }}>{a.detail}</Tiny> : null}
                <Tiny style={{ marginTop: 2 }}>{fmtDateTime(a.at)}</Tiny>
              </View>
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Book}
          title={q ? `Nothing matches "${q}"` : 'Nothing recorded yet'}
          note="Every change the committee makes is written here by the server."
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  li: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center', paddingTop: 1 },
});
