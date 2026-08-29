/**
 * Action sheets — pre-approve a visitor, raise a ticket, post a notice, share a
 * gate pass.
 *
 * The option lists come from @gvs/shared, the same module the API validates
 * against. Retyping "Plumbing, Electrical, Housekeeping…" here is how a client
 * ends up offering a category the server rejects.
 */
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import {
  HELP_ROLES, NOTICE_KINDS, TICKET_CATEGORIES, TICKET_PRIORITIES,
  VEHICLE_KINDS, VISITOR_CATEGORIES,
} from '@gvs/shared';
import Icons from '../icons';
import { Alert, Btn, Input, Select, Sheet, TextArea, Muted, Tiny, useForm } from './ui';
import QR from '../lib/qr';
import { useApp } from '../store';
import { useVisitors } from '../data/visitors';
import { useTickets } from '../data/tickets';
import { useNotices } from '../data/community';
import { catOf } from './entities';
import { fmtDate } from '../lib/format';
import { colors as c } from '../theme';

const titleCase = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const asOptions = (list) => list.map((x) => ({ value: x, label: titleCase(x) }));

/* ------------------------------------------------------------- gate pass -- */

/**
 * A pre-approved visitor's pass. The QR is the pass; the six characters under
 * it are the same value in a form a guard can key in when a camera will not
 * focus — which at a gate at night is often.
 */
export function GatePassSheet({ visitor, onClose }) {
  const { settings } = useApp();
  if (!visitor) return null;

  const share = () => Share.share({
    title: 'Gate pass',
    message: `Gate pass for ${settings.societyName}: ${visitor.passCode}`
      + (visitor.expectedAt ? `\nExpected ${fmtDate(visitor.expectedAt)}` : ''),
  }).catch(() => {});

  return (
    <Sheet title="Gate pass" onClose={onClose}>
      <View style={s.center}>
        <QR value={visitor.passCode} size={188} caption={visitor.passCode} />
        <Muted style={s.passNote}>
          Show this at the gate, or send it to {visitor.name} to show on arrival.
        </Muted>
      </View>
      <Btn block icon={Icons.Send} onPress={share} style={{ marginTop: 16 }}>Share pass</Btn>
      <Btn block variant="ghost" onPress={onClose} style={{ marginTop: 8 }}>Done</Btn>
    </Sheet>
  );
}

/* ---------------------------------------------------------- pre-approve --- */

export function PreApproveSheet({ onClose }) {
  const { me } = useApp();
  const { create } = useVisitors();
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState(null);
  const f = useForm({ name: '', category: 'guest', phone: '', purpose: '', vehicle: '' });

  const submit = async () => {
    setBusy(true);
    const r = await create({
      name: f.f.name.trim(),
      category: f.f.category,
      flatCode: me.flat,
      phone: f.f.phone,
      purpose: f.f.purpose,
      vehicle: f.f.vehicle,
      status: 'pre-approved',
    });
    setBusy(false);
    if (r.ok) setPass(r.visitor);
  };

  if (pass) return <GatePassSheet visitor={pass} onClose={onClose} />;

  return (
    <Sheet title="Pre-approve a visitor" onClose={onClose}>
      <Alert kind="info">
        The gate lets them in without calling you. You get a notification when they arrive.
      </Alert>
      <Input label="Visitor name" placeholder="e.g. Amazon delivery" {...f.bind('name')} />
      <Select
        label="Category" value={f.f.category} onChange={(v) => f.set('category', v)}
        options={VISITOR_CATEGORIES.map((x) => ({ value: x, label: catOf(x).label }))}
      />
      <Input label="Mobile (optional)" keyboardType="phone-pad" maxLength={10} {...f.bind('phone')} />
      <Input label="Purpose (optional)" placeholder="e.g. Package delivery" {...f.bind('purpose')} />
      <Input label="Vehicle (optional)" autoCapitalize="characters" placeholder="e.g. MH12 AB 1234" {...f.bind('vehicle')} />
      <Btn block icon={Icons.QR} onPress={submit} loading={busy} disabled={!f.f.name.trim()}>
        Create gate pass
      </Btn>
    </Sheet>
  );
}

/* --------------------------------------------------------- raise ticket --- */

export function RaiseTicketSheet({ onClose, onDone }) {
  const { me } = useApp();
  const { raise } = useTickets();
  const [busy, setBusy] = useState(false);
  const f = useForm({ title: '', category: 'Plumbing', priority: 'medium', body: '' });

  const submit = async () => {
    setBusy(true);
    const r = await raise({
      title: f.f.title.trim(),
      category: f.f.category,
      priority: f.f.priority,
      body: f.f.body,
      flatCode: me.flat,
    });
    setBusy(false);
    if (r.ok) { onDone?.(); onClose(); }
  };

  return (
    <Sheet title="Raise a complaint" onClose={onClose}>
      <Input label="What is wrong?" placeholder="e.g. Kitchen tap is leaking" {...f.bind('title')} />
      <Select
        label="Category" value={f.f.category} onChange={(v) => f.set('category', v)}
        options={TICKET_CATEGORIES}
      />
      <Select
        label="Priority" value={f.f.priority} onChange={(v) => f.set('priority', v)}
        options={asOptions(TICKET_PRIORITIES)}
      />
      <TextArea label="Details (optional)" placeholder="Anything the technician should know" {...f.bind('body')} />
      <Btn block icon={Icons.Ticket} onPress={submit} loading={busy} disabled={f.f.title.trim().length < 3}>
        Raise ticket
      </Btn>
    </Sheet>
  );
}

/* ---------------------------------------------------------- post notice --- */

export function PostNoticeSheet({ onClose }) {
  const { post } = useNotices();
  const [busy, setBusy] = useState(false);
  const f = useForm({ kind: 'notice', title: '', body: '', priority: 'normal', pinned: false });

  const submit = async () => {
    setBusy(true);
    const r = await post({
      kind: f.f.kind,
      title: f.f.title.trim(),
      body: f.f.body.trim(),
      priority: f.f.priority,
      pinned: f.f.pinned,
    });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title="Post a notice" onClose={onClose}>
      <Alert kind="info">Every resident in the society sees this.</Alert>
      <Select
        label="Kind" value={f.f.kind} onChange={(v) => f.set('kind', v)}
        options={asOptions(NOTICE_KINDS)}
      />
      <Input label="Title" placeholder="e.g. Water tank cleaning on Sunday" {...f.bind('title')} />
      <TextArea label="Notice" placeholder="Write the notice…" {...f.bind('body')} />
      <Select
        label="Priority" value={f.f.priority} onChange={(v) => f.set('priority', v)}
        options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'Urgent' }]}
      />
      <Btn
        block icon={Icons.Board} onPress={submit} loading={busy}
        disabled={f.f.title.trim().length < 3 || !f.f.body.trim()}
      >
        Post notice
      </Btn>
    </Sheet>
  );
}

/* ------------------------------------------------------------- vehicles --- */

export function AddVehicleSheet({ onClose, onAdd }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ number: '', kind: 'Car', model: '', slot: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onAdd({
      number: f.f.number.trim().toUpperCase(),
      kind: f.f.kind,
      model: f.f.model.trim(),
      slot: f.f.slot.trim(),
    });
    setBusy(false);
    if (r?.ok) onClose();
  };

  return (
    <Sheet title="Register a vehicle" onClose={onClose}>
      <Input
        label="Number plate" autoCapitalize="characters" placeholder="e.g. MH12 AB 1234"
        value={f.f.number} onChangeText={(v) => f.set('number', v.toUpperCase())}
      />
      <Select label="Type" value={f.f.kind} onChange={(v) => f.set('kind', v)} options={VEHICLE_KINDS} />
      <Input label="Model (optional)" placeholder="e.g. Maruti Swift" {...f.bind('model')} />
      <Input label="Parking slot (optional)" placeholder="e.g. B-12" {...f.bind('slot')} />
      <Btn block icon={Icons.Car} onPress={submit} loading={busy} disabled={!f.f.number.trim()}>
        Register vehicle
      </Btn>
    </Sheet>
  );
}

/* ----------------------------------------------------------- daily help --- */

export function AddHelpSheet({ onClose, onAdd }) {
  const { me } = useApp();
  const [busy, setBusy] = useState(false);
  const f = useForm({ name: '', role: 'Maid', phone: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onAdd({
      name: f.f.name.trim(),
      role: f.f.role,
      phone: f.f.phone,
      flatCode: me.flat,
    });
    setBusy(false);
    if (r?.ok) onClose();
  };

  return (
    <Sheet title="Add daily help" onClose={onClose}>
      <Tiny style={{ marginBottom: 12 }}>
        They get a staff card with a QR the gate scans on the way in and out.
      </Tiny>
      <Input label="Name" placeholder="e.g. Sunita Devi" {...f.bind('name')} />
      <Select label="Role" value={f.f.role} onChange={(v) => f.set('role', v)} options={HELP_ROLES} />
      <Input label="Mobile" keyboardType="phone-pad" maxLength={10} {...f.bind('phone')} />
      <Btn block icon={Icons.UserPlus} onPress={submit} loading={busy} disabled={!f.f.name.trim()}>
        Add
      </Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center' },
  passNote: { textAlign: 'center', marginTop: 14, color: c.ink3 },
});
