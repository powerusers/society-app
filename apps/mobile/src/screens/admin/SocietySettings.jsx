/**
 * Society settings.
 *
 * The accent is the one branded value in the app — societies override it and
 * nothing else in the design assumes a hue. Changing it here rebuilds the token
 * set; it does not need a new build of the app.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Alert, Btn, Card, H3, H4, Input, Muted, Section, Tiny, useForm,
} from '../../components/ui';
import { useApp } from '../../store';
import { api } from '../../lib/api';
import { ACCENTS } from '../../theme';
import { colors as c, radius } from '../../theme';

export default function SocietySettings() {
  const nav = useNavigation();
  const { settings, society, refreshMe, say, can } = useApp();
  const readOnly = !can('settings.write');
  const [busy, setBusy] = useState(false);
  const f = useForm({
    name: settings.societyName || '',
    address: settings.address || '',
    regNo: settings.regNo || '',
    gstin: settings.gstin || '',
    overstayMins: String(settings.overstayMins ?? 240),
    slaHours: String(settings.slaHours ?? 24),
    accent: settings.accent || 'indigo',
  });

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/setup/societies/${society?.id}`, {
        name: f.f.name.trim(),
        address: f.f.address.trim(),
        regNo: f.f.regNo.trim(),
        gstin: f.f.gstin.trim(),
        settings: {
          overstayMins: Number(f.f.overstayMins) || 240,
          slaHours: Number(f.f.slaHours) || 24,
          accent: f.f.accent,
        },
      });
      await refreshMe();
      say('Society settings saved.');
    } catch (e) {
      say(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Society Settings"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
    >
      {readOnly ? (
        <Alert kind="warn" icon={Icons.Lock}>
          You can see the society's settings but not change them. Only an administrator
          may edit these.
        </Alert>
      ) : (
        <Alert kind="info">
          These apply to every member of {settings.societyName} — on this app and on the web.
        </Alert>
      )}

      <Section title="Identity" />
      <Card>
        <Input label="Society name" {...f.bind('name')} />
        <Input label="Address" {...f.bind('address')} />
        <Input label="Registration number" {...f.bind('regNo')} />
        <Input label="GSTIN" autoCapitalize="characters" {...f.bind('gstin')} />
      </Card>

      <Section title="Rules the app enforces" />
      <Card>
        <Input
          label="Visitor overstay limit (minutes)"
          keyboardType="number-pad"
          hint="A visitor inside longer than this is flagged on the gate console and the resident's home screen."
          {...f.bind('overstayMins')}
        />
        <Input
          label="Helpdesk SLA (hours)"
          keyboardType="number-pad"
          hint="A ticket past this is shown as breached to the committee."
          {...f.bind('slaHours')}
        />
      </Card>

      <Section title="Accent" />
      <Card>
        <Muted style={{ marginBottom: 12 }}>
          The one branded colour in the app. Everything else is graphite and white by design.
        </Muted>
        <View style={s.swatches}>
          {Object.entries(ACCENTS).map(([key, a]) => (
            <Pressable
              key={key}
              onPress={() => f.set('accent', key)}
              style={[s.swatch, { backgroundColor: a.accent }, f.f.accent === key && s.swatchOn]}
            >
              {f.f.accent === key ? <Icons.Check size={18} color="#fff" /> : null}
            </Pressable>
          ))}
        </View>
      </Card>

      {readOnly ? null : (
        <Btn block icon={Icons.Check} onPress={save} loading={busy} style={{ marginTop: 8 }}>
          Save settings
        </Btn>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: {
    width: 44, height: 44, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchOn: { borderWidth: 2, borderColor: c.ink },
});
