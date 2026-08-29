/**
 * Register a flat.
 *
 * One deployment serves many societies, so the applicant has to say which one —
 * it decides both which flat register their code is checked against and which
 * committee is asked to approve them.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icons from '../icons';
import {
  Alert, Btn, Card, Input, ListGroup, SearchBar, Select, SkeletonList, Tiny, H4,
} from '../components/ui';
import Screen from '../components/Screen';
import { api } from '../lib/api';
import { colors as c, PAD, type } from '../theme';

const RELATIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'co-owner', label: 'Co-owner / family' },
  { value: 'tenant', label: 'Tenant' },
];

export default function Register({ onBack }) {
  const [f, setF] = useState({ name: '', block: '', flatNo: '', relation: 'owner', phone: '', email: '', password: '' });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [societies, setSocieties] = useState([]);
  const [societyId, setSocietyId] = useState('');
  const [q, setQ] = useState('');
  const [loadingSocieties, setLoadingSocieties] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingSocieties(true);
    // Debounced so typing a society name is not one request per keystroke.
    const t = setTimeout(() => {
      api.societies(q)
        .then((r) => { if (alive) setSocieties(r.societies || []); })
        .catch(() => { if (alive) setSocieties([]); })
        .finally(() => { if (alive) setLoadingSocieties(false); });
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const chosen = societies.find((x) => x.id === societyId);

  const submit = async () => {
    setErr(''); setFieldErr({});
    if (!societyId) return setErr('Choose your society first');

    setBusy(true);
    try {
      await api.register({
        name: f.name.trim(),
        societyId,
        flatCode: `${f.block.trim().toUpperCase()}-${f.flatNo.trim()}`,
        relation: f.relation,
        phone: f.phone,
        email: f.email.trim(),
        password: f.password,
      });
      setDone(true);
    } catch (e) {
      if (e.fieldErrors) setFieldErr(e.fieldErrors);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Screen title="Register your flat" onBack={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {done ? (
            <>
              <Alert kind="ok" icon={Icons.CheckCircle}>
                Registration submitted. The committee will verify your documents and approve
                access — you will be able to sign in once they do.
              </Alert>
              <Btn block onPress={onBack}>Back to sign in</Btn>
            </>
          ) : (
            <>
              <Alert kind="info">
                Your details are verified against the society's flat register before approval.
                Owners are asked for the sale deed; tenants for a rent agreement and police verification.
              </Alert>

              <Card>
                <H4 style={{ marginBottom: 4 }}>Your society</H4>
                <Tiny style={{ marginBottom: 10 }}>
                  Your application goes to this society's committee for approval.
                </Tiny>
                <SearchBar value={q} onChange={setQ} placeholder="Search by name or address…" />
                {loadingSocieties ? <SkeletonList rows={2} /> : (
                  <ListGroup>
                    {societies.map((x) => (
                      <Pressable
                        key={x.id}
                        onPress={() => { setSocietyId(x.id); setErr(''); }}
                        android_ripple={{ color: c.n100 }}
                        style={[s.li, x.id === societyId && s.liOn]}
                      >
                        <View style={s.grow}>
                          <H4>{x.name}</H4>
                          {x.address ? <Tiny style={{ marginTop: 3 }}>{x.address}</Tiny> : null}
                        </View>
                        {x.id === societyId
                          ? <Icons.CheckCircle size={18} color={c.accent} />
                          : <View style={{ width: 18 }} />}
                      </Pressable>
                    ))}
                    {!societies.length && (
                      <View style={s.li}>
                        <Tiny>
                          {q ? `No society matches "${q}".` : 'No societies are set up on this platform yet.'}
                        </Tiny>
                      </View>
                    )}
                  </ListGroup>
                )}
              </Card>

              <Card>
                <Input
                  label="Full name" value={f.name} error={fieldErr.name}
                  onChangeText={(v) => u('name', v)} placeholder="e.g. Rahul Mehta"
                />
                <View style={s.pair}>
                  <View style={s.grow}>
                    {/* Blocks belong to the chosen society's register, which is
                        not readable before approval — free text is the honest
                        control here, and the server checks it. */}
                    <Input
                      label="Block" value={f.block} maxLength={2} error={fieldErr.flatCode}
                      autoCapitalize="characters"
                      onChangeText={(v) => u('block', v.replace(/[^A-Za-z]/g, '').toUpperCase())}
                      placeholder="e.g. C"
                    />
                  </View>
                  <View style={s.grow}>
                    <Input
                      label="Flat no." value={f.flatNo} error={fieldErr.flatCode}
                      keyboardType="number-pad"
                      onChangeText={(v) => u('flatNo', v)} placeholder="e.g. 401"
                    />
                  </View>
                </View>
                {chosen ? (
                  <Text style={s.hint}>Checked against the flat register for {chosen.name}.</Text>
                ) : null}

                <Select
                  label="I am the" value={f.relation} onChange={(v) => u('relation', v)}
                  options={RELATIONS}
                />
                <Input
                  label="Mobile" value={f.phone} maxLength={10} error={fieldErr.phone}
                  keyboardType="phone-pad"
                  onChangeText={(v) => u('phone', v.replace(/\D/g, ''))} placeholder="10-digit number"
                />
                <Input
                  label="Email" value={f.email} error={fieldErr.email}
                  keyboardType="email-address" autoCapitalize="none"
                  onChangeText={(v) => u('email', v)} placeholder="you@email.com"
                />
                <Input
                  label="Password" value={f.password} error={fieldErr.password}
                  secureTextEntry autoCapitalize="none"
                  onChangeText={(v) => u('password', v)} placeholder="Minimum 8 characters"
                />
                {err ? <Text style={s.err}>{err}</Text> : null}
                <Btn block onPress={submit} loading={busy}>
                  {busy ? 'Submitting…' : 'Submit for approval'}
                </Btn>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: PAD, paddingBottom: 40, paddingTop: 4 },
  grow: { flex: 1, minWidth: 0 },
  pair: { flexDirection: 'row', gap: 10 },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  liOn: { backgroundColor: c.accentSoft },
  hint: { ...type.tiny, marginTop: -8, marginBottom: 12 },
  err: { fontSize: 12, color: c.bad, marginBottom: 10 },
});
