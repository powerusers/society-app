/** Security incidents — the society's register of what went wrong at the gate. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Alert, Btn, Chips, Empty, ListGroup, Section, Select, Sheet, SkeletonList,
  Stat, StatRow, TextArea, Input, useForm,
} from '../../components/ui';
import { IncidentRow } from '../../components/entities';
import { useApp } from '../../store';
import { useIncidents } from '../../data/incidents';

const TYPES = [
  { value: 'theft', label: 'Theft / attempted theft' },
  { value: 'misbehaviour', label: 'Misbehaviour with security' },
  { value: 'trespass', label: 'Trespass / forced entry' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'fire', label: 'Fire / safety' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export default function Incidents() {
  const nav = useNavigation();
  const { can } = useApp();
  const { incidents, loading, raise, close, refetch } = useIncidents();
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(false);
  const [closing, setClosing] = useState(null);

  const list = filter === 'all' ? incidents : incidents.filter((i) => i.status === filter);
  const open = incidents.filter((i) => i.status === 'open');

  return (
    <Screen
      title="Incidents"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
      right={can('incident.write')
        ? <Btn size="sm" variant="danger" icon={Icons.Plus} onPress={() => setSheet(true)}>Log</Btn>
        : null}
    >
      <StatRow>
        <Stat value={open.length} label="Open" />
        <Stat value={open.filter((i) => i.severity === 'high').length} label="High severity" divided />
        <Stat value={incidents.length} label="All time" divided />
      </StatRow>

      {open.filter((i) => i.severity === 'high').length > 0 ? (
        <Alert kind="err" icon={Icons.AlertTri}>
          There {open.filter((i) => i.severity === 'high').length === 1 ? 'is' : 'are'}{' '}
          {open.filter((i) => i.severity === 'high').length} open high-severity incident
          {open.filter((i) => i.severity === 'high').length > 1 ? 's' : ''}.
        </Alert>
      ) : null}

      <Section title="Register" />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />

      {loading && !incidents.length ? <SkeletonList rows={5} /> : list.length ? (
        <ListGroup>
          {list.map((i) => (
            <View key={i.id}>
              <IncidentRow i={i} />
              {i.status === 'open' && can('incident.write') ? (
                <View style={s.closeRow}>
                  <Btn size="sm" variant="outline" onPress={() => setClosing(i)}>Close incident</Btn>
                </View>
              ) : null}
            </View>
          ))}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Shield}
          title={filter === 'all' ? 'No incidents logged' : `Nothing ${filter}`}
          note="A quiet register is the point. Anything logged here reaches the committee."
        />
      )}

      {sheet ? <LogSheet onClose={() => setSheet(false)} onRaise={raise} /> : null}
      {closing ? (
        <CloseSheet i={closing} onClose={() => setClosing(null)} onCloseIncident={close} />
      ) : null}
    </Screen>
  );
}

function LogSheet({ onClose, onRaise }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ type: 'theft', severity: 'medium', involves: '', note: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onRaise({
      type: f.f.type,
      severity: f.f.severity,
      involves: f.f.involves.trim(),
      note: f.f.note.trim(),
    });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="Log an incident" onClose={onClose}>
      <Alert kind="warn" icon={Icons.AlertTri}>
        This goes on the society's permanent register and reaches the committee.
      </Alert>
      <Select label="Type" value={f.f.type} onChange={(v) => f.set('type', v)} options={TYPES} />
      <Select label="Severity" value={f.f.severity} onChange={(v) => f.set('severity', v)} options={SEVERITIES} />
      <Input label="Who or what is involved" placeholder="e.g. Flat B-204, silver Swift" {...f.bind('involves')} />
      <TextArea label="What happened" placeholder="In your own words…" {...f.bind('note')} />
      <Btn block variant="danger" icon={Icons.AlertTri} onPress={submit} loading={busy} disabled={!f.f.note.trim()}>
        Log incident
      </Btn>
    </Sheet>
  );
}

function CloseSheet({ i, onClose, onCloseIncident }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ resolution: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onCloseIncident(i.id, f.f.resolution.trim());
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="Close incident" onClose={onClose}>
      <TextArea label="How was it resolved?" placeholder="What was done about it…" {...f.bind('resolution')} />
      <Btn block icon={Icons.Check} onPress={submit} loading={busy} disabled={!f.f.resolution.trim()}>
        Close incident
      </Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  closeRow: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'flex-start' },
});
