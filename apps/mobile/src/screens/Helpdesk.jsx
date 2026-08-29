/**
 * Helpdesk.
 *
 * A resident sees their flat's tickets; staff and committee see the queue. The
 * SLA clock is the point of the screen — a ticket past its SLA is the loudest
 * thing in the list.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TICKET_STATUSES } from '@gvs/shared';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Btn, Chips, Empty, H3, H4, Hairline, Input, ListGroup, Muted,
  Section, Select, Sheet, SkeletonList, StatRow, Stat, Tiny, useTick,
} from '../components/ui';
import { TicketRow, STATUS_COLOR } from '../components/entities';
import { RaiseTicketSheet } from '../components/sheets';
import { useApp } from '../store';
import { useTickets } from '../data/tickets';
import { ago, fmtDateTime, until } from '../lib/format';
import { colors as c, PAD } from '../theme';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function Helpdesk() {
  const nav = useNavigation();
  const { can } = useApp();
  const { tickets, loading, refetch, update, comment, rate } = useTickets();
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(null);
  useTick(60000); // keeps the SLA clocks honest while the screen is open

  const list = useMemo(
    () => (filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter],
  );

  const live = tickets.filter((t) => t.status === 'open' || t.status === 'in-progress');
  const breached = live.filter((t) => until(t.slaDueAt).late);

  return (
    <Screen
      title="Helpdesk"
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
      right={<Btn size="sm" icon={Icons.Plus} onPress={() => setSheet('raise')}>Raise</Btn>}
    >
      <StatRow>
        <Stat value={live.length} label="Open" />
        <Stat value={breached.length} label="Past SLA" divided />
        <Stat value={tickets.filter((t) => t.status === 'resolved').length} label="Resolved" divided />
      </StatRow>

      {breached.length > 0 && can('helpdesk.manage') ? (
        <Alert kind="err" icon={Icons.AlertTri}>
          {breached.length} ticket{breached.length > 1 ? 's are' : ' is'} past the agreed SLA.
        </Alert>
      ) : null}

      <Section title="Tickets" />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />

      {loading && !tickets.length ? <SkeletonList rows={5} /> : list.length ? (
        <ListGroup>
          {list.map((t) => <TicketRow key={t.id} t={t} onPress={() => setOpen(t)} />)}
        </ListGroup>
      ) : (
        <Empty
          icon={Icons.Ticket}
          title={filter === 'all' ? 'No tickets' : `Nothing ${filter}`}
          note="Complaints you raise, and their progress, appear here."
          action={<Btn icon={Icons.Plus} onPress={() => setSheet('raise')}>Raise a complaint</Btn>}
        />
      )}

      {sheet === 'raise' ? <RaiseTicketSheet onClose={() => setSheet(null)} /> : null}
      {open ? (
        <TicketSheet
          t={open}
          onClose={() => setOpen(null)}
          canManage={can('helpdesk.manage')}
          onUpdate={update}
          onComment={comment}
          onRate={rate}
        />
      ) : null}
    </Screen>
  );
}

function TicketSheet({ t, onClose, canManage, onUpdate, onComment, onRate }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sla = until(t.slaDueAt);
  const live = t.status === 'open' || t.status === 'in-progress';

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const r = await onComment(t.id, text.trim());
    setBusy(false);
    if (r.ok) setText('');
  };

  return (
    <Sheet title={t.title} onClose={onClose}>
      <View style={s.wrap}>
        <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
        <Badge>{t.category}</Badge>
        {t.priority === 'high' ? <Badge color="red">high priority</Badge> : null}
        {live ? (
          <Badge color={sla.late ? 'red' : ''}>
            {sla.late ? `SLA over by ${sla.txt}` : `${sla.txt} to SLA`}
          </Badge>
        ) : null}
      </View>

      <Tiny style={{ marginTop: 10 }}>
        {[t.ref, t.flatCode && `Flat ${t.flatCode}`, ago(t.at)].filter(Boolean).join(' · ')}
      </Tiny>
      {t.body ? <Muted style={{ marginTop: 10 }}>{t.body}</Muted> : null}

      {canManage ? (
        <>
          <Hairline style={{ marginHorizontal: 0 }} />
          <Select
            label="Status"
            value={t.status}
            onChange={(v) => onUpdate(t.id, { status: v })}
            options={TICKET_STATUSES.map((x) => ({ value: x, label: x }))}
          />
        </>
      ) : null}

      {t.status === 'resolved' && !t.rating ? (
        <>
          <Hairline style={{ marginHorizontal: 0 }} />
          <H4 style={{ marginBottom: 8 }}>How did it go?</H4>
          <View style={s.wrap}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Btn key={n} size="sm" variant="outline" onPress={() => onRate(t.id, n)}>{`${n} ★`}</Btn>
            ))}
          </View>
        </>
      ) : null}

      <Section title={`Updates (${t.comments?.length || 0})`} />
      <ListGroup>
        {(t.comments || []).map((cm) => (
          <View key={cm.id} style={s.li}>
            <View style={s.grow}>
              <H4>{cm.author || cm.byName}</H4>
              <Muted style={{ marginTop: 2 }}>{cm.text || cm.body}</Muted>
              <Tiny style={{ marginTop: 3 }}>{fmtDateTime(cm.at)}</Tiny>
            </View>
          </View>
        ))}
        {!t.comments?.length ? <View style={s.li}><Tiny>No updates yet.</Tiny></View> : null}
      </ListGroup>

      <Input placeholder="Add an update…" value={text} onChangeText={setText} />
      <Btn block icon={Icons.Send} onPress={send} loading={busy} disabled={!text.trim()}>Post update</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
});
