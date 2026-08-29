/**
 * Home — what needs this resident's attention, in the order it needs it.
 *
 * Ported from apps/web/src/screens/Home.jsx. The committee snapshot the web
 * version draws from the local store's ledger selectors is not here: those
 * selectors read seeded data, and there is no endpoint behind them. The
 * dashboard tab carries what the API can actually answer.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Blink, Btn, Empty, EmojiTile, H1, H4, ListGroup, Panel,
  Section, SkeletonCard, Tiny, LinkBtn,
} from '../components/ui';
import {
  ApproveDeny, HelpRow, NoticeCard, OverstayPill, QuickAction, VisitorCard,
} from '../components/entities';
import { PreApproveSheet, RaiseTicketSheet } from '../components/sheets';
import { useApp } from '../store';
import { useVisitors } from '../data/visitors';
import { useBills } from '../data/bills';
import { useNotices, usePolls } from '../data/community';
import { useBookings } from '../data/amenities';
import { useHelp } from '../data/help';
import { useTickets } from '../data/tickets';
import { cycleLabel, fmtDate, fmtTime, inr } from '../lib/format';
import { colors as c, PAD, type } from '../theme';

export default function Home() {
  const nav = useNavigation();
  const { me, settings } = useApp();
  const flat = me?.flat;

  const { visitors, transition, refetch: refetchVisitors } = useVisitors();
  const { bills, loading: billsLoading, refetch: refetchBills } = useBills({ flatCode: flat || undefined });
  const { notices, loading: noticesLoading, refetch: refetchNotices } = useNotices();
  const { polls, vote, refetch: refetchPolls } = usePolls();
  const { bookings } = useBookings();
  const { help } = useHelp();
  const { tickets } = useTickets();
  const [sheet, setSheet] = useState(null);

  const dues = bills.filter((b) => b.status !== 'paid').reduce((sum, b) => sum + Number(b.total || 0), 0);
  const dueBill = bills.find((b) => b.status !== 'paid');
  const pending = visitors.filter((v) => v.status === 'pending' && v.flatCode === flat);
  const inside = visitors.filter((v) => v.status === 'inside' && v.flatCode === flat);
  const helpIn = help.filter((h) => h.status === 'in');
  const myTickets = tickets.filter((t) => t.status !== 'closed' && (!flat || t.flatCode === flat));
  const today = new Date().toISOString().slice(0, 10);
  const myBookings = bookings.filter((b) => b.status !== 'cancelled' && b.date >= today);
  /* Tallies are withheld until this person has voted, so the poll shown here is
     one they still owe a vote on. */
  const openPoll = polls.find((p) => p.status === 'open' && !p.myVote);

  const refresh = () => Promise.all([
    refetchVisitors(), refetchBills(), refetchNotices(), refetchPolls(),
  ]);

  return (
    <Screen title={settings.societyName} sub={flat ? `Flat ${flat}` : me?.designation} onRefresh={refresh}>
      {/* A committee member or administrator need not live here. Showing them a
          dues panel for a flat they do not have produced "Flat null is fully
          paid up" on the first screen after sign-in. */}
      {flat ? (
        <Panel>
          <Tiny style={s.onPanel}>{dues ? 'Outstanding' : 'Nothing outstanding'}</Tiny>
          <H1 style={{ color: '#fff', marginTop: 6 }}>{inr(dues)}</H1>
          <Tiny style={[s.onPanel, { marginTop: 6 }]}>
            {dueBill
              ? `${cycleLabel(dueBill.cycle)} · due ${fmtDate(dueBill.dueDate)}`
              : `Flat ${flat} is fully paid up.`}
          </Tiny>
          {dueBill ? (
            <Btn variant="white" block style={{ marginTop: 14 }} onPress={() => nav.navigate('Payments')}>
              {`Pay ${inr(dueBill.total)}`}
            </Btn>
          ) : null}
        </Panel>
      ) : (
        <Panel>
          <Tiny style={s.onPanel}>Signed in as</Tiny>
          <H1 style={{ color: '#fff', marginTop: 6 }}>{me?.name}</H1>
          <Tiny style={[s.onPanel, { marginTop: 6 }]}>
            {[me?.designation, settings.societyName].filter(Boolean).join(' · ')}
          </Tiny>
        </Panel>
      )}

      {billsLoading && !bills.length ? <SkeletonCard /> : null}

      {/* live gate activity */}
      {pending.length > 0 ? (
        <>
          <View style={s.warnAlert}>
            <Blink />
            <Tiny style={s.warnTxt}>
              <Tiny style={s.bold}>
                {pending.length} visitor{pending.length > 1 ? 's are' : ' is'} waiting at the gate
              </Tiny>
              {' for your approval.'}
            </Tiny>
          </View>
          {pending.map((v) => (
            <VisitorCard
              key={v.id}
              v={v}
              actions={(
                <ApproveDeny
                  onApprove={() => transition(v, 'approved')}
                  onDeny={() => transition(v, 'denied')}
                />
              )}
            />
          ))}
        </>
      ) : null}

      {inside.length > 0 ? (
        <ListGroup>
          {inside.map((v) => (
            <View key={v.id} style={s.li}>
              <View style={s.icoTile}><Icons.Box size={18} color={c.ink4} /></View>
              <View style={s.grow}>
                <H4>{v.name} is inside</H4>
                <Tiny style={{ marginTop: 2 }}>
                  Entered at {fmtTime(v.entryAt)} · {v.purpose || v.category}
                </Tiny>
              </View>
              <OverstayPill v={v} defaultMins={settings.overstayMins} />
            </View>
          ))}
        </ListGroup>
      ) : null}

      <Section title="Quick actions" />
      <View style={s.grid2}>
        {/* Both of these raise something against a flat, and the server refuses a
            caller who is not a member of one — so they are offered only to
            someone who has a flat to raise them for. */}
        {flat ? <QuickAction icon={Icons.UserPlus} label="Pre-approve visitor" onPress={() => setSheet('pre')} /> : null}
        {flat ? <QuickAction icon={Icons.Ticket} label="Raise a complaint" onPress={() => setSheet('ticket')} /> : null}
        <QuickAction icon={Icons.Calendar} label="Book an amenity" onPress={() => nav.navigate('AmenitiesScreen')} />
        <QuickAction icon={Icons.Users} label="Daily help & staff" onPress={() => nav.navigate('DailyHelpScreen')} />
        <QuickAction icon={Icons.Car} label="Vehicles & parking" onPress={() => nav.navigate('VehiclesScreen')} />
        <QuickAction icon={Icons.Phone} label="Emergency contacts" tone="red" onPress={() => nav.navigate('EmergencyScreen')} />
      </View>

      {openPoll ? (
        <>
          <Section title="Your vote is pending" />
          <View style={s.card}>
            <H4 style={{ marginBottom: 10, fontSize: 14.5 }}>{openPoll.question}</H4>
            {(openPoll.options || []).map((o) => (
              <Btn
                key={o.id}
                variant="outline"
                block
                style={{ marginBottom: 7 }}
                onPress={() => vote(openPoll.id, o.id)}
              >
                {o.text}
              </Btn>
            ))}
            {/* No turnout here: the tallies are withheld until this person has
                voted, so quoting a count would be quoting a number the server
                deliberately did not send. */}
            <Tiny>Closes {fmtDate(openPoll.closesAt)} · results after you vote</Tiny>
          </View>
        </>
      ) : null}

      {help.length > 0 ? (
        <>
          <Section
            title="Your daily help"
            action={<LinkBtn onPress={() => nav.navigate('DailyHelpScreen')}>{helpIn.length} inside →</LinkBtn>}
          />
          <ListGroup>{help.slice(0, 3).map((h) => <HelpRow key={h.id} h={h} />)}</ListGroup>
        </>
      ) : null}

      {myTickets.length > 0 ? (
        <>
          <Section
            title="Your open complaints"
            action={<LinkBtn onPress={() => nav.navigate('HelpdeskScreen')}>All →</LinkBtn>}
          />
          <ListGroup>
            {myTickets.slice(0, 2).map((t) => (
              <View key={t.id} style={s.li}>
                <View style={s.icoTile}><Icons.Ticket size={18} color={c.ink4} /></View>
                <View style={s.grow}>
                  <H4 numberOfLines={1}>{t.title}</H4>
                  <Tiny style={{ marginTop: 2 }}>{t.ref} · {t.category}</Tiny>
                </View>
                <Badge color={t.status === 'open' ? 'amber' : 'blue'}>{t.status}</Badge>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}

      {myBookings.length > 0 ? (
        <>
          <Section
            title="Upcoming bookings"
            action={<LinkBtn onPress={() => nav.navigate('AmenitiesScreen')}>Book →</LinkBtn>}
          />
          <ListGroup>
            {myBookings.map((b) => (
              <View key={b.id} style={s.li}>
                <EmojiTile>{b.amenityEmoji}</EmojiTile>
                <View style={s.grow}>
                  <H4>{b.amenityName}</H4>
                  <Tiny style={{ marginTop: 2 }}>{fmtDate(b.date)} · {b.slot}</Tiny>
                </View>
                <Badge color={b.status === 'confirmed' ? 'green' : 'amber'}>{b.status}</Badge>
              </View>
            ))}
          </ListGroup>
        </>
      ) : null}

      <Section
        title="Notice board"
        action={<LinkBtn onPress={() => nav.navigate('Community')}>View all →</LinkBtn>}
      />
      {notices.slice(0, 2).map((n) => (
        <NoticeCard key={n.id} n={n} onPress={() => nav.navigate('Community')} />
      ))}
      {!notices.length && !noticesLoading ? (
        <Empty
          icon={Icons.Board}
          title="No notices yet"
          note="Notices from the committee appear here."
        />
      ) : null}

      {sheet === 'pre' ? <PreApproveSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'ticket' ? <RaiseTicketSheet onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  onPanel: { color: 'rgba(255,255,255,0.5)' },
  bold: { fontWeight: '600' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  card: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15, marginBottom: 10, marginTop: 8,
  },
  li: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: PAD,
    borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface,
  },
  icoTile: { width: 26, alignItems: 'center', justifyContent: 'center' },
  warnAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: c.warnBg, borderColor: c.warnLine, borderWidth: 1,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10,
  },
  warnTxt: { ...type.tiny, color: c.warn, flex: 1, fontSize: 12.5, lineHeight: 18 },
});
