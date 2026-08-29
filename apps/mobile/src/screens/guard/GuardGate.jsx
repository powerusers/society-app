/**
 * Gate console — the guard's main screen.
 *
 * A request goes to the flat for approval. Nothing enters without the resident's
 * yes, or a valid pre-approved pass.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { VISITOR_CATEGORIES } from '@gvs/shared';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import QrScanner from '../../components/QrScanner';
import {
  Alert, Badge, Btn, Empty, H3, H4, Input, ListGroup, Section, Select, Sheet,
  SkeletonList, Stat, StatRow, Tiny, useForm,
} from '../../components/ui';
import { VisitorCard, ApproveDeny, CatTile, catOf, STATUS_COLOR } from '../../components/entities';
import { useApp } from '../../store';
import { useVisitors, useGates } from '../../data/visitors';
import { ago, fmtTime } from '../../lib/format';
import { Pressable } from 'react-native';
import { colors as c, PAD } from '../../theme';

export default function GuardGate() {
  const nav = useNavigation();
  const { settings } = useApp();
  const { visitors, loading, transition, create, verifyPass, refetch } = useVisitors();
  const { gates } = useGates();
  const [sheet, setSheet] = useState(null);

  const waiting = visitors.filter((v) => v.status === 'waiting' || v.status === 'pending');
  const expected = visitors.filter((v) => v.status === 'pre-approved' || v.status === 'approved');
  const inside = visitors.filter((v) => v.status === 'inside');

  return (
    <Screen
      title="Gate"
      sub={settings.societyName}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.Plus} onPress={() => setSheet('new')}>New</Btn>}
    >
      <StatRow>
        <Stat value={waiting.length} label="Awaiting approval" />
        <Stat value={expected.length} label="Expected" divided />
        <Stat value={inside.length} label="Inside" divided />
      </StatRow>

      <View style={s.actions}>
        <Btn block variant="outline" icon={Icons.QR} onPress={() => setSheet('scan')} style={s.grow}>
          Scan pass
        </Btn>
        <Btn block variant="outline" icon={Icons.Car} onPress={() => nav.navigate('VehiclesScreen')} style={s.grow}>
          Plate lookup
        </Btn>
      </View>

      {waiting.length > 0 ? (
        <>
          <Section title="At the gate" />
          {waiting.map((v) => (
            <VisitorCard
              key={v.id}
              v={v}
              actions={v.status === 'waiting' ? (
                <Btn size="sm" icon={Icons.Send} onPress={() => transition(v, 'pending')}>
                  Send to flat
                </Btn>
              ) : (
                <Tiny>Waiting on {v.flatCode} to answer</Tiny>
              )}
            />
          ))}
        </>
      ) : null}

      {expected.length > 0 ? (
        <>
          <Section title="Approved — let them in" />
          <ListGroup>
            {expected.map((v) => (
              <View key={v.id} style={s.li}>
                <CatTile category={v.category} />
                <View style={s.grow}>
                  <H4>{v.name}</H4>
                  <Tiny style={{ marginTop: 2 }}>
                    {[`Flat ${v.flatCode}`, v.passCode ? `Pass ${v.passCode}` : null].filter(Boolean).join(' · ')}
                  </Tiny>
                </View>
                <Btn size="sm" icon={Icons.Check} onPress={() => transition(v, 'inside')}>Admit</Btn>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}

      {inside.length > 0 ? (
        <>
          <Section title="Inside now" />
          <ListGroup>
            {inside.map((v) => (
              <View key={v.id} style={s.li}>
                <CatTile category={v.category} />
                <View style={s.grow}>
                  <H4>{v.name}</H4>
                  <Tiny style={{ marginTop: 2 }}>
                    Flat {v.flatCode} · in at {fmtTime(v.entryAt)}
                  </Tiny>
                </View>
                <Btn size="sm" variant="outline" onPress={() => transition(v, 'exited')}>Mark out</Btn>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}

      {loading && !visitors.length ? <SkeletonList rows={4} /> : null}
      {!loading && !visitors.length ? (
        <Empty
          icon={Icons.Gate}
          title="Gate is clear"
          note="New entries and pre-approved passes appear here."
        />
      ) : null}

      {sheet === 'new' ? (
        <NewEntrySheet gates={gates} onClose={() => setSheet(null)} onCreate={create} />
      ) : null}
      {sheet === 'scan' ? (
        <ScanSheet onClose={() => setSheet(null)} verifyPass={verifyPass} onAdmit={transition} />
      ) : null}
    </Screen>
  );
}

function NewEntrySheet({ gates, onClose, onCreate }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ name: '', category: 'guest', flatCode: '', phone: '', purpose: '', vehicle: '', gateId: gates[0]?.id });

  const submit = async () => {
    setBusy(true);
    const r = await onCreate({
      name: f.f.name.trim(),
      category: f.f.category,
      flatCode: f.f.flatCode.trim().toUpperCase(),
      phone: f.f.phone,
      purpose: f.f.purpose,
      vehicle: f.f.vehicle,
      gateId: f.f.gateId,
      status: 'waiting',
    });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="New entry" onClose={onClose}>
      <Alert kind="info">
        A request goes to the flat for approval. Nothing enters without the resident's yes —
        or a valid pre-approved pass.
      </Alert>
      <Input label="Visitor name" {...f.bind('name')} />
      <Select
        label="Category" value={f.f.category} onChange={(v) => f.set('category', v)}
        options={VISITOR_CATEGORIES.map((x) => ({ value: x, label: catOf(x).label }))}
      />
      <Input
        label="Flat" placeholder="e.g. A-401" autoCapitalize="characters"
        value={f.f.flatCode} onChangeText={(v) => f.set('flatCode', v.toUpperCase())}
      />
      {gates.length > 1 ? (
        <Select
          label="Gate" value={f.f.gateId} onChange={(v) => f.set('gateId', v)}
          options={gates.map((g) => ({ value: g.id, label: g.name }))}
        />
      ) : null}
      <Input label="Mobile" keyboardType="phone-pad" maxLength={10} {...f.bind('phone')} />
      <Input label="Purpose" {...f.bind('purpose')} />
      <Input label="Vehicle" autoCapitalize="characters" {...f.bind('vehicle')} />
      <Btn block icon={Icons.Send} onPress={submit} loading={busy} disabled={!f.f.name.trim() || !f.f.flatCode.trim()}>
        Send to flat
      </Btn>
    </Sheet>
  );
}

/**
 * Verifying a gate pass.
 *
 * The web app's version of this is explicitly a stand-in — its own comment reads
 * "Stands in for the device camera: type or paste the 6-character pass code."
 * On a phone the camera is right there, so this screen is where the native app
 * earns its place.
 *
 * The typed code stays underneath, always visible rather than hidden behind a
 * "having trouble?" link. A camera at a gate at night frequently will not focus,
 * a cracked screen protector defeats it entirely, and a guard with somebody
 * waiting should never have to hunt for the way out. Both routes hit the same
 * /api/visitors/verify-pass endpoint.
 */
function ScanSheet({ onClose, verifyPass, onAdmit }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [found, setFound] = useState(null);

  /* Shared by both routes, so a scanned pass and a typed one behave identically —
     including the failure, which stays inline rather than becoming a toast. A
     pass that does not verify is a normal outcome at a gate, not an error. */
  const verify = useCallback(async (value) => {
    if (!value || busy) return;
    setErr(''); setBusy(true);
    const res = await verifyPass(value);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error?.message || 'That pass could not be verified');
      /* Put what was scanned into the box: a QR that verified against nothing is
         usually the wrong code rather than a misread, and the guard can see it
         and correct it by hand. */
      setCode(String(value).toUpperCase().slice(0, 6));
      return;
    }
    setFound(res.visitor);
  }, [busy, verifyPass]);

  const check = () => verify(code);

  return (
    <Sheet title="Scan gate pass" onClose={onClose}>
      {!found ? (
        <>
          <QrScanner
            onScan={verify}
            hint="Point the camera at the resident's QR pass"
          />
          <Input
            label="Or key in the code printed under it"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            placeholder="e.g. K4M9TP"
            error={err}
            onChangeText={(v) => { setCode(v.toUpperCase()); setErr(''); }}
            onSubmitEditing={check}
          />
          <Btn block icon={Icons.Check} onPress={check} loading={busy} disabled={code.length < 6}>
            {busy ? 'Checking…' : 'Verify pass'}
          </Btn>
        </>
      ) : (
        <>
          <Alert kind="ok" icon={Icons.CheckCircle}>
            <H4 style={{ color: c.ok }}>Valid pass.</H4> Pre-approved by the flat.
          </Alert>
          <H3>{found.name}</H3>
          <Tiny style={{ marginTop: 4 }}>
            {[catOf(found.category).label, `Flat ${found.flatCode}`, found.purpose].filter(Boolean).join(' · ')}
          </Tiny>
          <View style={{ marginTop: 8, flexDirection: 'row' }}>
            <Badge color={STATUS_COLOR[found.status]}>{found.status}</Badge>
          </View>
          <Btn
            block icon={Icons.Check} style={{ marginTop: 16 }}
            onPress={async () => { await onAdmit(found, 'inside'); onClose(); }}
          >
            Admit {found.name}
          </Btn>
          <Btn block variant="ghost" style={{ marginTop: 8 }} onPress={() => { setFound(null); setCode(''); }}>
            Scan another
          </Btn>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
