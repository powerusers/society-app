/**
 * Resident directory.
 *
 * Numbers and email arrive masked unless the resident consented to share them.
 * `contactHidden` says so outright, so the app never offers to dial a masked
 * number — the web app added that field for exactly this reason.
 */
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Avatar, Badge, Empty, H4, ListGroup, SearchBar, SkeletonList, Tiny,
} from '../components/ui';
import { useDirectory } from '../data/directory';
import { colors as c, PAD } from '../theme';

export default function Directory() {
  const nav = useNavigation();
  const { directory, loading, refetch } = useDirectory();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return directory;
    return directory.filter((u) => (
      u.name?.toLowerCase().includes(needle) || u.flat?.toLowerCase().includes(needle)
    ));
  }, [directory, q]);

  return (
    <Screen title="Resident Directory" onBack={() => nav.goBack()} onRefresh={refetch}>
      <SearchBar value={q} onChange={setQ} placeholder="Search by name or flat…" />

      {loading && !directory.length ? <SkeletonList rows={6} /> : list.length ? (
        <ListGroup>
          {list.map((u) => (
            <View key={u.id} style={s.li}>
              <Avatar name={u.name} />
              <View style={s.grow}>
                <H4 numberOfLines={1}>{u.name}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[u.flat ? `Flat ${u.flat}` : null, u.relation, u.designation].filter(Boolean).join(' · ')}
                </Tiny>
                <Tiny style={{ marginTop: 2 }}>{u.phone || 'No number shared'}</Tiny>
              </View>
              {/* Offered only when the number is real. Dialling bullet
                  characters is worse than not offering the button. */}
              {!u.contactHidden && u.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${u.phone}`)} hitSlop={8} style={s.call}>
                  <Icons.Phone size={17} color={c.accent} />
                </Pressable>
              ) : (
                <Badge>Private</Badge>
              )}
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Users}
          title={q ? `No resident matches "${q}"` : 'Directory is empty'}
          note="Residents who have been approved by the committee appear here."
        />
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
  call: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
});
