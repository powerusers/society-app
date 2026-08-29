/**
 * Staff check-in — daily help in and out of the society.
 *
 * The gate scans the staff card; this screen is the register behind it. Marking
 * someone in starts the clock a resident sees on their home screen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import QrScanner from '../../components/QrScanner';
import {
  Alert, Badge, Btn, Empty, H4, Input, ListGroup, SearchBar, Section, Sheet,
  SkeletonList, Stat, StatRow, Tiny, Avatar,
} from '../../components/ui';
import { useHelp } from '../../data/help';
import { fmtTime } from '../../lib/format';
import { colors as c, PAD } from '../../theme';

export default function GuardCheckin() {
  const { help, loading, mark, byCard, refetch } = useHelp({ all: true });
  const [q, setQ] = useState('');
  const [scan, setScan] = useState(false);

  const inside = help.filter((h) => h.status === 'in');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return help;
    return help.filter((h) => (
      h.name?.toLowerCase().includes(needle)
      || h.cardCode?.toLowerCase().includes(needle)
      || (h.flats || []).some((x) => x.toLowerCase().includes(needle))
    ));
  }, [help, q]);

  return (
    <Screen
      title="Staff Check-in"
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.QR} onPress={() => setScan(true)}>Scan card</Btn>}
    >
      <StatRow>
        <Stat value={inside.length} label="Inside now" />
        <Stat value={help.length - inside.length} label="Outside" divided />
        <Stat value={help.length} label="Registered" divided />
      </StatRow>

      <SearchBar value={q} onChange={setQ} placeholder="Search a name, card or flat…" />

      <Section title="Register" />
      {loading && !help.length ? <SkeletonList rows={6} /> : list.length ? (
        <ListGroup>
          {list.map((h) => (
            <View key={h.id} style={s.li}>
              <Avatar name={h.name} />
              <View style={s.grow}>
                <H4 numberOfLines={1}>{h.name}</H4>
                <Tiny style={{ marginTop: 2 }}>
                  {[h.role, (h.flats || []).join(', ')].filter(Boolean).join(' · ')}
                </Tiny>
                <View style={s.wrap}>
                  <Badge color={h.status === 'in' ? 'green' : ''}>
                    {h.status === 'in' ? `In since ${fmtTime(h.lastIn)}` : 'Outside'}
                  </Badge>
                  {h.policeVerified ? null : <Badge color="amber">Unverified</Badge>}
                </View>
              </View>
              <Btn
                size="sm"
                variant={h.status === 'in' ? 'outline' : ''}
                onPress={() => mark(h.id, { direction: h.status === 'in' ? 'out' : 'in' })}
              >
                {h.status === 'in' ? 'Mark out' : 'Mark in'}
              </Btn>
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Finger}
          title={q ? `Nobody matches "${q}"` : 'Nobody registered'}
          note="Residents register their daily help; they appear here with a scannable card."
        />
      )}

      {scan ? <CardSheet onClose={() => setScan(false)} byCard={byCard} mark={mark} /> : null}
    </Screen>
  );
}

/**
 * Staff card lookup — camera first, typed code underneath.
 *
 * The same arrangement as the gate pass, and for the same reason: this runs at a
 * gate at shift change with a queue of people, so both routes stay on screen and
 * both hit the same endpoint.
 */
function CardSheet({ onClose, byCard, mark }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [found, setFound] = useState(null);

  const lookup = useCallback(async (value) => {
    if (!value || busy) return;
    setErr(''); setBusy(true);
    const res = await byCard(value);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error?.message || 'No staff card matches that code');
      setCode(String(value).toUpperCase().slice(0, 8));
      return;
    }
    setFound(res.help);
  }, [busy, byCard]);

  const check = () => lookup(code);

  return (
    <Sheet title="Scan staff card" onClose={onClose}>
      {!found ? (
        <>
          <QrScanner onScan={lookup} hint="Point the camera at the staff card" />
          <Input
            label="Or key in the card code"
            value={code}
            autoCapitalize="characters"
            placeholder="e.g. 4TB9KM"
            error={err}
            onChangeText={(v) => { setCode(v.toUpperCase()); setErr(''); }}
            onSubmitEditing={check}
          />
          <Btn block icon={Icons.Check} onPress={check} loading={busy} disabled={!code.trim()}>
            Look up card
          </Btn>
        </>
      ) : (
        <>
          <Alert kind={found.policeVerified ? 'ok' : 'warn'} icon={Icons.Shield}>
            {found.policeVerified ? 'Police verified.' : 'This helper is not police verified.'}
          </Alert>
          <View style={s.foundRow}>
            <Avatar name={found.name} size="lg" />
            <View style={s.grow}>
              <H4 style={{ fontSize: 16 }}>{found.name}</H4>
              <Tiny style={{ marginTop: 3 }}>{found.role} · {(found.flats || []).join(', ')}</Tiny>
              <View style={s.wrap}>
                <Badge color={found.status === 'in' ? 'green' : ''}>
                  {found.status === 'in' ? `In since ${fmtTime(found.lastIn)}` : 'Outside'}
                </Badge>
              </View>
            </View>
          </View>
          <Btn
            block
            icon={Icons.Check}
            style={{ marginTop: 16 }}
            onPress={async () => {
              await mark(found.id, { direction: found.status === 'in' ? 'out' : 'in' });
              onClose();
            }}
          >
            {found.status === 'in' ? 'Mark out' : 'Mark in'}
          </Btn>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, alignItems: 'center' },
  foundRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 8 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
