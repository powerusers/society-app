/** My profile — contact details, notification preference, password. */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Avatar, Badge, Btn, Card, H3, H4, Hairline, Input, Section, Sheet,
  Toggle, Tiny, Muted, useForm,
} from '../components/ui';
import { useApp } from '../store';
import { api } from '../lib/api';
import { pushAvailable } from '../lib/push';
import { canUseFullScreenIntent, openFullScreenIntentSettings } from '../lib/gate';
import { fmtDate } from '../lib/format';
import { colors as c } from '../theme';

export default function Profile() {
  const nav = useNavigation();
  const { me, role, settings, refreshMe, say } = useApp();
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  /* Android 14 stopped granting USE_FULL_SCREEN_INTENT to anything that merely
     asks for it. Without it a gate request still arrives and still rings, but as
     a heads-up the resident has to tap rather than a screen that wakes the
     phone — so it is worth telling them, and worth offering the one Settings
     page that can change it. */
  const [fullScreen, setFullScreen] = useState(true);
  useEffect(() => { canUseFullScreenIntent().then(setFullScreen); }, []);
  const f = useForm({ name: me?.name || '', phone: me?.phone || '' });

  const save = async () => {
    setBusy(true);
    try {
      /* name, phone and notify are the only fields PATCH /api/me accepts.
         Email identifies the account and changing it is not self-service, so it
         is shown read-only rather than sent and silently dropped. */
      await api.patch('/api/me', { name: f.f.name.trim(), phone: f.f.phone });
      await refreshMe();
      say('Profile updated.');
      setSheet(null);
    } catch (e) {
      say(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  /* `notify` is a map of named preferences on the server, merged into a jsonb
     column — not one boolean. Sending a bare `true` is rejected as a 422. */
  const setNotify = async (key, on) => {
    try {
      await api.patch('/api/me', { notify: { [key]: on } });
      await refreshMe();
    } catch (e) {
      say(e.message, 'bad');
    }
  };

  return (
    <Screen title="My Profile" onBack={() => nav.goBack()}>
      <Card>
        <View style={s.head}>
          <Avatar name={me?.name} size="lg" />
          <View style={s.grow}>
            <H3>{me?.name}</H3>
            <Tiny style={{ marginTop: 3 }}>
              {[me?.flat ? `Flat ${me.flat}` : me?.designation, settings.societyName].filter(Boolean).join(' · ')}
            </Tiny>
            <View style={s.badges}>
              <Badge color="brand">{role}</Badge>
              {me?.relation ? <Badge>{me.relation}</Badge> : null}
            </View>
          </View>
        </View>
        <Hairline />
        <Field label="Mobile" value={me?.phone || '—'} />
        <Field label="Email" value={me?.email || '—'} />
        <Field label="Member since" value={me?.joined ? fmtDate(me.joined) : '—'} />
        <Btn block variant="outline" icon={Icons.Edit} onPress={() => setSheet('edit')} style={{ marginTop: 12 }}>
          Edit details
        </Btn>
      </Card>

      <Section title="Notifications" />
      <Card>
        {/* Default on: a resident who has not expressed a preference should still
            hear about somebody standing at their gate. */}
        <Toggle
          on={me?.notify?.gate !== false}
          onChange={(on) => setNotify('gate', on)}
          label="Gate requests"
          desc="A visitor waiting at the gate for your approval."
        />
        <Hairline />
        <Toggle
          on={me?.notify?.society !== false}
          onChange={(on) => setNotify('society', on)}
          label="Society updates"
          desc="Notices, bills and helpdesk replies."
        />
        {!pushAvailable() ? (
          <Alert kind="info" icon={Icons.Info}>
            This build has no push configuration, so alerts appear only while the app
            is open. Gate requests still show up as soon as you open it.
          </Alert>
        ) : !fullScreen ? (
          <>
            <Alert kind="warn" icon={Icons.Alert}>
              Gate requests cannot wake your phone. Android needs one extra permission
              before a visitor at the gate can light up the screen the way a call does.
            </Alert>
            <Btn
              block
              variant="outline"
              icon={Icons.Settings}
              onPress={() => openFullScreenIntentSettings()}
            >
              Allow full-screen alerts
            </Btn>
          </>
        ) : null}
      </Card>

      <Section title="Security" />
      <Card>
        <Btn block variant="outline" icon={Icons.Lock} onPress={() => setSheet('password')}>
          Change password
        </Btn>
      </Card>

      {sheet === 'edit' ? (
        <Sheet title="Edit details" onClose={() => setSheet(null)}>
          <Input label="Full name" {...f.bind('name')} />
          <Input label="Mobile" keyboardType="phone-pad" maxLength={10} {...f.bind('phone')} />
          <Input
            label="Email"
            value={me?.email || ''}
            editable={false}
            hint="Your email identifies the account. Ask the committee to change it."
          />
          <Btn block onPress={save} loading={busy}>Save</Btn>
        </Sheet>
      ) : null}

      {sheet === 'password' ? <PasswordSheet onClose={() => setSheet(null)} say={say} /> : null}
    </Screen>
  );
}

const Field = ({ label, value }) => (
  <View style={s.field}>
    <Tiny style={s.fieldLabel}>{label}</Tiny>
    <H4>{value}</H4>
  </View>
);

function PasswordSheet({ onClose, say }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const f = useForm({ current: '', next: '', confirm: '' });

  const submit = async () => {
    setErr('');
    if (f.f.next.length < 8) return setErr('New password must be at least 8 characters');
    if (f.f.next !== f.f.confirm) return setErr('The two new passwords do not match');
    setBusy(true);
    try {
      await api.post('/api/me/password', { currentPassword: f.f.current, newPassword: f.f.next });
      say('Password changed.');
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet title="Change password" onClose={onClose}>
      <Input label="Current password" secureTextEntry autoCapitalize="none" {...f.bind('current')} />
      <Input label="New password" secureTextEntry autoCapitalize="none" hint="At least 8 characters." {...f.bind('next')} />
      <Input label="Confirm new password" secureTextEntry autoCapitalize="none" {...f.bind('confirm')} />
      {err ? <Alert kind="err" icon={Icons.Alert}>{err}</Alert> : null}
      <Btn block icon={Icons.Lock} onPress={submit} loading={busy}>Change password</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 7 },
  field: { paddingVertical: 8 },
  fieldLabel: { marginBottom: 3 },
});
