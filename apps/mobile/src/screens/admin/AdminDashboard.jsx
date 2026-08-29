/**
 * Committee dashboard.
 *
 * Only what the API can answer, which here means collections, the helpdesk queue
 * and pending approvals — all of it read from endpoints rather than computed on
 * the device.
 *
 * The deeper accounting screens (ledger, budget vs actual, bank reconciliation,
 * report exports) are deliberately absent rather than stubbed: they have no API
 * behind them, and a dashboard that links to a dead end is worse than one that
 * does not mention it. They are on the web app, and in the backlog in
 * apps/mobile/README.md.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Alert, Badge, Bar, Card, H3, Section, SkeletonCard, Stat, StatRow, Tiny,
} from '../../components/ui';
import { QuickAction } from '../../components/entities';
import { useApp } from '../../store';
import { useBills } from '../../data/bills';
import { useTickets } from '../../data/tickets';
import { useRegistrations } from '../../data/society';
import { useIncidents } from '../../data/incidents';
import { useVisitors } from '../../data/visitors';
import { cycleLabel, inr, lakh, pct, thisCycle, until } from '../../lib/format';
import { colors as c, PAD } from '../../theme';

export default function AdminDashboard() {
  const nav = useNavigation();
  const { can, settings } = useApp();
  const cycle = thisCycle();
  const { bills, loading, refetch } = useBills({ cycle });
  const { tickets } = useTickets();
  const { registrations } = useRegistrations();
  const { incidents } = useIncidents();
  const { visitors } = useVisitors();

  const billed = bills.reduce((sum, b) => sum + Number(b.total || 0), 0);
  const collected = bills.filter((b) => b.status === 'paid').reduce((sum, b) => sum + Number(b.total || 0), 0);
  const share = pct(collected, billed);

  const liveTickets = tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved');
  const breached = liveTickets.filter((t) => until(t.slaDueAt).late);
  const pendingApprovals = registrations.filter((r) => r.status === 'pending');
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const inside = visitors.filter((v) => v.status === 'inside');

  return (
    <Screen
      title="Committee Dashboard"
      sub={settings.societyName}
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
    >
      {loading && !bills.length ? <SkeletonCard /> : null}

      <Card>
        <View style={s.row}>
          <View style={s.grow}>
            <Tiny>Collections this cycle</Tiny>
            <H3 style={{ marginTop: 3 }}>
              {lakh(collected)} <Tiny>of {lakh(billed)}</Tiny>
            </H3>
          </View>
          <Badge color={share > 70 ? 'green' : 'amber'}>{cycleLabel(cycle)}</Badge>
        </View>
        <View style={{ marginTop: 10 }}>
          <Bar value={collected} max={billed} color={share > 70 ? c.ok : c.warn} />
        </View>
        <Tiny style={{ marginTop: 8 }}>
          {inr(billed - collected)} still outstanding across {bills.filter((b) => b.status !== 'paid').length} flats.
        </Tiny>
      </Card>

      <StatRow>
        <Stat value={`${share}%`} label="Collected" />
        <Stat value={liveTickets.length} label="Open tickets" divided />
        <Stat value={pendingApprovals.length} label="Approvals" divided />
      </StatRow>

      {breached.length > 0 ? (
        <Alert kind="err" icon={Icons.AlertTri}>
          {breached.length} helpdesk ticket{breached.length > 1 ? 's are' : ' is'} past the agreed SLA.
        </Alert>
      ) : null}

      {pendingApprovals.length > 0 ? (
        <Alert kind="warn" icon={Icons.UserPlus}>
          {pendingApprovals.length} resident registration{pendingApprovals.length > 1 ? 's are' : ' is'} waiting
          for the committee's approval.
        </Alert>
      ) : null}

      <Section title="Right now" />
      <StatRow>
        <Stat value={inside.length} label="Visitors inside" />
        <Stat value={openIncidents.length} label="Open incidents" divided />
        <Stat value={breached.length} label="Past SLA" divided />
      </StatRow>

      <Section title="Manage" />
      <View style={s.grid}>
        {can('billing.make') ? <QuickAction icon={Icons.Bank} label="Billing run" onPress={() => nav.navigate('BillingScreen')} /> : null}
        {can('resident.approve') ? <QuickAction icon={Icons.Users} label="Residents & approvals" onPress={() => nav.navigate('ResidentsScreen')} /> : null}
        {can('resident.approve') ? <QuickAction icon={Icons.Building} label="Flat register" onPress={() => nav.navigate('FlatRegisterScreen')} /> : null}
        {can('staff.manage') ? <QuickAction icon={Icons.Tools} label="Society staff" onPress={() => nav.navigate('StaffMgmtScreen')} /> : null}
        {can('settings.view') ? <QuickAction icon={Icons.Settings} label="Society settings" onPress={() => nav.navigate('SocietySettingsScreen')} /> : null}
        {can('settings.view') ? <QuickAction icon={Icons.Book} label="Audit trail" onPress={() => nav.navigate('AuditScreen')} /> : null}
      </View>

    </Screen>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
