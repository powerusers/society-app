/**
 * Entity cards — the React Native port of apps/web/src/components/entities.jsx.
 *
 * One difference throughout: the web components fall back to `sel.userName(id)`
 * and `sel.gate(id)` when a record carries an id rather than a name. Those
 * selectors read the seeded local store, which this app does not have — and does
 * not need, because in live mode the API already sends `gateName`, `byName`,
 * `assignedToName` and `author`. The lookups are gone rather than reimplemented.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icons from '../icons';
import { Avatar, Badge, Btn, useTick, H3, H4, Tiny, Muted } from './ui';
import { useApp } from '../store';
import { ago, cycleLabel, fmtDate, fmtDateTime, fmtTime, inr, minsBetween, until } from '../lib/format';
import { colors as c, PAD, radius, type } from '../theme';

/** Visitor categories carry an icon and a tone — no emoji in structural UI. */
export const CAT = {
  delivery: { label: 'Delivery', icon: Icons.Box, tone: 'blue' },
  guest: { label: 'Guest', icon: Icons.User, tone: 'brand' },
  service: { label: 'Service', icon: Icons.Tools, tone: 'amber' },
  cab: { label: 'Cab', icon: Icons.Car, tone: 'purple' },
  staff: { label: 'Daily help', icon: Icons.Broom, tone: 'green' },
};

export const catOf = (x) => CAT[x] || CAT.guest;

export const STATUS_COLOR = {
  'pre-approved': 'blue', approved: 'green', pending: 'amber', waiting: 'purple',
  denied: 'red', inside: 'green', exited: '', open: 'amber', 'in-progress': 'blue',
  resolved: 'green', closed: '', paid: 'green', issued: 'amber', overdue: 'red',
  'pending-approval': 'purple', draft: '', confirmed: 'green', cancelled: 'red', active: 'green',
};

export const CatTile = ({ category, size = 17 }) => {
  const k = catOf(category);
  return <View style={s.icoTile}><k.icon size={size} color={c.ink4} /></View>;
};

/** Live overstay state for a visitor who is currently inside the building. */
export const overstay = (v, defaultMins = 20) => {
  if (v.status !== 'inside' || !v.entryAt) return null;
  const limit = v.allowedMins || defaultMins;
  const spent = minsBetween(v.entryAt);
  return { spent, limit, over: spent > limit, by: spent - limit };
};

export function OverstayPill({ v, defaultMins }) {
  useTick(20000);
  const o = overstay(v, defaultMins);
  if (!o) return null;
  return o.over
    ? <Badge color="red">Over by {o.by}m</Badge>
    : <Badge color="green">{o.limit - o.spent}m left</Badge>;
}

/** Only rendered once a visitor is actually inside — and loud only when over. */
export function OverstayNote({ v, defaultMins }) {
  useTick(20000);
  const o = overstay(v, defaultMins);
  if (!o) return null;
  return o.over
    ? <Text style={s.overNote}>Inside {o.spent} min — {o.by} over the {o.limit} minute limit</Text>
    : <Tiny style={{ marginTop: 8 }}>Inside {o.spent} of {o.limit} minutes</Tiny>;
}

export function VisitorCard({ v, actions }) {
  const { settings } = useApp();
  const k = catOf(v.category);
  /* Detail is written as one sentence rather than stacked micro-lines: it reads
     faster and stops every record turning into a five-row block. */
  const detail = [k.label, `Flat ${v.flatCode}`, v.gateName].filter(Boolean).join(' · ');
  const meta = [v.purpose, v.phone, v.raisedBy && `via ${v.raisedBy}`].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      <View style={s.rowTop}>
        <View style={s.grow}>
          <H3 numberOfLines={1}>{v.name}</H3>
          <Tiny style={{ marginTop: 4 }}>{detail}</Tiny>
          {meta ? <Tiny style={{ marginTop: 3 }}>{meta}</Tiny> : null}
        </View>
        <View style={s.right}>
          <Badge color={STATUS_COLOR[v.status]}>{v.status}</Badge>
          <Tiny style={{ marginTop: 5 }}>{ago(v.createdAt)}</Tiny>
        </View>
      </View>
      <OverstayNote v={v} defaultMins={settings.overstayMins} />
      {actions ? <View style={s.actions}>{actions}</View> : null}
    </View>
  );
}

const NOTICE_KIND = {
  notice: { label: 'Notice', tone: 'blue' },
  event: { label: 'Event', tone: 'green' },
  payment: { label: 'Payment', tone: 'amber' },
  alert: { label: 'Alert', tone: 'red' },
};

export function NoticeCard({ n, onPress }) {
  const k = NOTICE_KIND[n.kind] || NOTICE_KIND.notice;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: c.n100 }} style={s.card}>
      <View style={[s.row, { marginBottom: 7 }]}>
        <View style={s.wrap}>
          <Badge color={k.tone}>{k.label}</Badge>
          {n.pinned ? <Badge>Pinned</Badge> : null}
          {n.priority === 'high' ? <Badge solid>Urgent</Badge> : null}
        </View>
        <Tiny>{ago(n.at)}</Tiny>
      </View>
      <H3 style={{ marginBottom: 5 }}>{n.title}</H3>
      <Muted numberOfLines={3}>{n.body}</Muted>
      <View style={[s.row, { marginTop: 11 }]}>
        {/* Already a name: the API sends it, since only the server can look up a
            user the client was never given. */}
        <Tiny>{n.author}</Tiny>
        <View style={s.wrap}>
          {Object.entries(n.reactions || {}).map(([e, count]) => (
            <Badge key={e} bare>{e} {count}</Badge>
          ))}
          {n.comments?.length > 0 ? <Badge bare>{n.comments.length} replies</Badge> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function TicketRow({ t, onPress }) {
  const sla = until(t.slaDueAt);
  const open = t.status === 'open' || t.status === 'in-progress';
  const breached = open && sla.late;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: c.n100 }} style={s.li}>
      <View style={s.grow}>
        <H4 numberOfLines={1}>{t.title}</H4>
        <Tiny style={{ marginTop: 3 }}>
          {[t.ref, t.category, t.flatCode, ago(t.at), t.assignedToName].filter(Boolean).join(' · ')}
        </Tiny>
        <View style={[s.wrap, { marginTop: 6, gap: 12 }]}>
          <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
          {t.priority === 'high' ? <Badge color="red">high priority</Badge> : null}
          {open && breached ? <Badge color="red">SLA over by {sla.txt}</Badge> : null}
          {open && !breached ? <Badge>{sla.txt} to SLA</Badge> : null}
        </View>
      </View>
      <Icons.Fwd size={15} color={c.ink4} />
    </Pressable>
  );
}

export function BillRow({ b, onPress }) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: c.n100 }} style={s.li}>
      <View style={s.grow}>
        <H4>{cycleLabel(b.cycle)}</H4>
        <Tiny style={{ marginTop: 3 }}>
          {b.status === 'paid' && b.receiptNo
            ? `Paid ${fmtDate(b.paidAt)} · ${b.receiptNo}`
            : `Due ${fmtDate(b.dueDate)}`}
        </Tiny>
      </View>
      <View style={s.right}>
        <H4>{inr(b.total)}</H4>
        <View style={{ marginTop: 4 }}><Badge color={STATUS_COLOR[b.status]}>{b.status}</Badge></View>
      </View>
    </Pressable>
  );
}

export function HelpRow({ h, right, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} android_ripple={onPress ? { color: c.n100 } : undefined} style={s.li}>
      <Avatar name={h.name} />
      <View style={s.grow}>
        <H4 numberOfLines={1}>{h.name}</H4>
        <Tiny style={{ marginTop: 3 }}>{[h.role, (h.flats || []).join(', ')].filter(Boolean).join(' · ')}</Tiny>
        <View style={[s.wrap, { marginTop: 6, gap: 12 }]}>
          <Badge color={h.status === 'in' ? 'green' : ''}>
            {h.status === 'in' ? `In since ${fmtTime(h.lastIn)}` : 'Outside'}
          </Badge>
          {h.policeVerified ? <Badge>Police verified</Badge> : null}
          {/* Nobody has rated them yet is a fact worth stating; "null ★" is not. */}
          <Tiny>{h.rating ? `${h.rating} ★` : 'Not rated'}</Tiny>
        </View>
      </View>
      {right}
    </Wrapper>
  );
}

export function IncidentRow({ i }) {
  const color = { high: 'red', medium: 'amber', low: '' }[i.severity];
  return (
    <View style={s.li}>
      <View style={s.grow}>
        {/* Only the type is capitalised. Applying it to the whole line re-cased
            the guard's own words — "flat b-204" came back as "Flat B-204", and a
            register that rewrites what was written is a poor register. */}
        <H4>
          <Text style={s.cap}>{i.type}</Text>
          {i.involves ? ` · ${i.involves}` : ''}
        </H4>
        {i.note ? <Tiny style={{ marginTop: 3 }}>{i.note}</Tiny> : null}
        <View style={[s.wrap, { marginTop: 6, gap: 12 }]}>
          <Badge color={color}>{i.severity} severity</Badge>
          <Badge color={i.status === 'open' ? 'amber' : 'green'}>{i.status}</Badge>
          <Tiny>{[i.byName, fmtDateTime(i.at)].filter(Boolean).join(' · ')}</Tiny>
        </View>
      </View>
    </View>
  );
}

export const QuickAction = ({ icon: I, label, onPress, tone }) => (
  <Pressable onPress={onPress} android_ripple={{ color: c.n100 }} style={s.quick}>
    <I size={17} color={tone === 'red' ? c.bad : c.ink3} />
    <Text style={s.quickTxt}>{String(label).replace(/\n/g, ' ')}</Text>
  </Pressable>
);

export const ApproveDeny = ({ onApprove, onDeny }) => (
  <>
    <Btn size="sm" icon={Icons.Check} onPress={onApprove}>Approve</Btn>
    <Btn size="sm" variant="outline" icon={Icons.X} onPress={onDeny}>Deny</Btn>
  </>
);

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  right: { alignItems: 'flex-end' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  card: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 15, marginBottom: 10,
  },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
  overNote: { ...type.tiny, marginTop: 8, color: c.bad, fontWeight: '500' },
  cap: { textTransform: 'capitalize' },
  /* Two per row, wrapping.
   *
   * `flex: 1` here was wrong: in a flexWrap row, a flexible basis lets every
   * child shrink to fit one line rather than wrapping, so six tiles became six
   * slivers a single character wide. A fixed basis is what makes them wrap;
   * flexGrow then shares out the remainder so a trailing odd tile fills its
   * row. 47% rather than 50% leaves room for the gap. */
  quick: {
    flexBasis: '47%', flexGrow: 1, minWidth: 140,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 13,
  },
  quickTxt: { fontSize: 13, fontWeight: '400', color: c.ink, lineHeight: 18, flex: 1 },
});
