/**
 * Payments.
 *
 * Recording a receipt against a bill works; an online payment gateway is
 * deliberately out of scope for this phase, exactly as on the web. The "Pay"
 * action records how the resident paid — it does not move money.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PAYMENT_MODES } from '@gvs/shared';
import Icons from '../icons';
import Screen from '../components/Screen';
import {
  Alert, Badge, Btn, Card, Empty, H1, H3, H4, Hairline, Input, ListGroup, Panel,
  Section, Select, Sheet, SkeletonList, Tiny, Muted, useForm,
} from '../components/ui';
import { BillRow, STATUS_COLOR } from '../components/entities';
import { useApp } from '../store';
import { useBills } from '../data/bills';
import { cycleLabel, fmtDate, inr } from '../lib/format';
import { colors as c } from '../theme';

export default function Payments() {
  const { me } = useApp();
  const flat = me?.flat;
  const { bills, loading, pay, refetch } = useBills({ flatCode: flat || undefined });
  const [open, setOpen] = useState(null);
  const [paying, setPaying] = useState(null);

  const dues = bills.filter((b) => b.status !== 'paid').reduce((sum, b) => sum + Number(b.total || 0), 0);
  const unpaid = bills.filter((b) => b.status !== 'paid');
  const paid = bills.filter((b) => b.status === 'paid');

  if (!flat) {
    return (
      <Screen title="Payments">
        <Empty
          icon={Icons.Rupee}
          title="No flat on this account"
          note="Maintenance bills are raised against a flat. Committee and staff accounts without one have nothing to show here."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Payments" sub={`Flat ${flat}`} onRefresh={refetch}>
      <Panel>
        <Tiny style={s.onPanel}>{dues ? 'Total outstanding' : 'Nothing outstanding'}</Tiny>
        <H1 style={{ color: '#fff', marginTop: 6 }}>{inr(dues)}</H1>
        <Tiny style={[s.onPanel, { marginTop: 6 }]}>
          {unpaid.length ? `${unpaid.length} unpaid bill${unpaid.length > 1 ? 's' : ''}` : 'All bills settled.'}
        </Tiny>
      </Panel>

      {loading && !bills.length ? <SkeletonList rows={4} /> : null}

      {unpaid.length > 0 ? (
        <>
          <Section title="Due now" />
          {unpaid.map((b) => (
            <Card key={b.id}>
              <View style={s.row}>
                <View style={s.grow}>
                  <H3>{cycleLabel(b.cycle)}</H3>
                  <Tiny style={{ marginTop: 3 }}>Due {fmtDate(b.dueDate)}</Tiny>
                </View>
                <View style={s.right}>
                  <H3>{inr(b.total)}</H3>
                  <View style={{ marginTop: 4 }}>
                    <Badge color={STATUS_COLOR[b.status]}>{b.status}</Badge>
                  </View>
                </View>
              </View>
              <Hairline />
              <View style={s.actions}>
                <Btn size="sm" variant="outline" onPress={() => setOpen(b)}>View breakup</Btn>
                <Btn size="sm" icon={Icons.Rupee} onPress={() => setPaying(b)}>Record payment</Btn>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {paid.length > 0 ? (
        <>
          <Section title="Paid" />
          <ListGroup>
            {paid.map((b) => <BillRow key={b.id} b={b} onPress={() => setOpen(b)} />)}
          </ListGroup>
        </>
      ) : null}

      {!loading && !bills.length ? (
        <Empty icon={Icons.Rupee} title="No bills yet" note="Maintenance bills appear here once the committee issues them." />
      ) : null}

      {open ? <BreakupSheet bill={open} onClose={() => setOpen(null)} /> : null}
      {paying ? <PaySheet bill={paying} onPay={pay} onClose={() => setPaying(null)} /> : null}
    </Screen>
  );
}

/** The line items behind a bill total — what the maintenance actually pays for. */
function BreakupSheet({ bill, onClose }) {
  const lines = bill.lines || bill.items || [];
  return (
    <Sheet title={cycleLabel(bill.cycle)} onClose={onClose}>
      {lines.length ? lines.map((l, i) => (
        <View key={l.id || l.head || i} style={s.lineRow}>
          <View style={s.grow}>
            <H4>{l.head || l.label}</H4>
            {l.note ? <Tiny style={{ marginTop: 2 }}>{l.note}</Tiny> : null}
          </View>
          <H4>{inr(l.amount)}</H4>
        </View>
      )) : <Muted>No line items on this bill.</Muted>}

      <Hairline style={{ marginHorizontal: 0 }} />
      <View style={s.lineRow}>
        <H3 style={s.grow}>Total</H3>
        <H3>{inr(bill.total)}</H3>
      </View>
      {bill.status === 'paid' && bill.receiptNo ? (
        <Alert kind="ok" icon={Icons.CheckCircle}>
          Paid {fmtDate(bill.paidAt)} · receipt {bill.receiptNo}
        </Alert>
      ) : null}
      <Btn block variant="ghost" onPress={onClose} style={{ marginTop: 12 }}>Close</Btn>
    </Sheet>
  );
}

/**
 * Records a receipt. The society is not collecting the money through this app,
 * so the resident states how they paid and the treasurer reconciles it against
 * the bank statement — which is why the reference matters more than the amount.
 */
function PaySheet({ bill, onPay, onClose }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ mode: 'UPI', reference: '', amount: String(bill.total) });

  const submit = async () => {
    setBusy(true);
    const r = await onPay(bill, {
      amount: Number(f.f.amount),
      mode: f.f.mode,
      reference: f.f.reference.trim(),
    });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title={`Record payment · ${cycleLabel(bill.cycle)}`} onClose={onClose}>
      <Alert kind="info">
        This records a payment you have already made. The treasurer reconciles it against
        the society's bank statement.
      </Alert>
      <Input label="Amount" keyboardType="decimal-pad" {...f.bind('amount')} />
      <Select label="Paid by" value={f.f.mode} onChange={(v) => f.set('mode', v)} options={PAYMENT_MODES} />
      <Input
        label="Reference / UTR"
        placeholder="e.g. UPI transaction id"
        hint="Helps the treasurer match this against the bank statement."
        {...f.bind('reference')}
      />
      <Btn block icon={Icons.Check} onPress={submit} loading={busy}>Record {inr(Number(f.f.amount) || 0)}</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  right: { alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  onPanel: { color: 'rgba(255,255,255,0.5)' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
});
