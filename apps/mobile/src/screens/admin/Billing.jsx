/**
 * Billing run, with its maker-checker gate.
 *
 * The officer who drafts a run may not approve it. That rule is the server's —
 * `canApprove` and `approvalBlockedBy` come back from /api/bills/runs/:cycle —
 * and this screen states the server's reason rather than guessing at one.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icons from '../../icons';
import Screen from '../../components/Screen';
import {
  Alert, Badge, Btn, Card, Confirm, H1, H3, Input, Muted, Panel, Section,
  Sheet, SkeletonCard, Stat, StatRow, Tiny, useForm,
} from '../../components/ui';
import { useBillingRun } from '../../data/bills';
import { cycleLabel, inr, shiftCycle, thisCycle } from '../../lib/format';
import { colors as c } from '../../theme';

export default function Billing() {
  const nav = useNavigation();
  const [cycle, setCycle] = useState(thisCycle());
  const { run, loading, draft, approve, discard, refetch } = useBillingRun(cycle);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const drafted = run && Number(run.drafts) > 0;
  const issued = run && Number(run.bills) > 0;

  return (
    <Screen
      title="Billing"
      sub={cycleLabel(cycle)}
      onBack={nav.canGoBack() ? () => nav.goBack() : undefined}
      onRefresh={refetch}
    >
      <View style={s.cycleRow}>
        <Btn size="sm" variant="outline" icon={Icons.Back} onPress={() => setCycle(shiftCycle(cycle, -1))}>
          Previous
        </Btn>
        <Btn
          size="sm" variant="outline" onPress={() => setCycle(shiftCycle(cycle, 1))}
          disabled={cycle >= thisCycle()}
        >
          Next
        </Btn>
      </View>

      {loading && !run ? <SkeletonCard /> : null}

      <Panel>
        <Tiny style={s.onPanel}>Billed this cycle</Tiny>
        <H1 style={{ color: '#fff', marginTop: 6 }}>{inr(run?.billed || 0)}</H1>
        <Tiny style={[s.onPanel, { marginTop: 6 }]}>
          Collected {inr(run?.collected || 0)}
        </Tiny>
      </Panel>

      <StatRow>
        <Stat value={run?.bills || 0} label="Issued" />
        <Stat value={run?.drafts || 0} label="In draft" divided />
        <Stat value={run?.flats || 0} label="Flats" divided />
      </StatRow>

      {drafted ? (
        <>
          <Section title="Awaiting approval" />
          {/* The server decides; this reports what it said. */}
          {run.canApprove ? (
            <Alert kind="info" icon={Icons.Check}>
              {run.drafts} draft bills are ready. Approving issues them to every flat.
            </Alert>
          ) : (
            <Alert kind="warn" icon={Icons.Lock}>
              {run.approvalBlockedBy || 'You cannot approve this run.'}
            </Alert>
          )}
          <View style={s.actions}>
            <Btn
              variant="outline" icon={Icons.Trash} style={s.grow}
              onPress={() => setConfirm('discard')}
            >
              Discard draft
            </Btn>
            <Btn
              icon={Icons.Check} style={s.grow} disabled={!run.canApprove}
              onPress={() => setConfirm('approve')}
            >
              Approve & issue
            </Btn>
          </View>
        </>
      ) : null}

      {!drafted && !issued ? (
        <>
          <Section title="No run for this cycle" />
          <Card flat>
            <Muted style={{ marginBottom: 12 }}>
              Drafting a run calculates every flat's bill from the society's heads and rates.
              Nothing is issued until a second officer approves it.
            </Muted>
            <Btn block icon={Icons.Plus} onPress={() => setSheet(true)}>Draft billing run</Btn>
          </Card>
        </>
      ) : null}

      {issued ? (
        <>
          <Section title="Issued" />
          <Alert kind="ok" icon={Icons.CheckCircle}>
            {run.bills} bills issued for {cycleLabel(cycle)}.
          </Alert>
        </>
      ) : null}

      {sheet ? <DraftSheet cycle={cycle} onClose={() => setSheet(false)} onDraft={draft} /> : null}

      {confirm === 'approve' ? (
        <Confirm
          title="Approve and issue?"
          body={`${run.drafts} bills go out to every flat and become payable. This cannot be undone.`}
          confirmLabel="Approve & issue"
          onConfirm={approve}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'discard' ? (
        <Confirm
          title="Discard the draft?"
          body="The drafted bills are deleted. Nothing has been issued, so no resident sees a change."
          confirmLabel="Discard"
          danger
          onConfirm={discard}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </Screen>
  );
}

function DraftSheet({ cycle, onClose, onDraft }) {
  const [busy, setBusy] = useState(false);
  const f = useForm({ dueDate: '', note: '' });

  const submit = async () => {
    setBusy(true);
    const r = await onDraft({ dueDate: f.f.dueDate || undefined, note: f.f.note.trim() });
    setBusy(false);
    if (r.ok) onClose();
  };

  return (
    <Sheet title={`Draft run · ${cycleLabel(cycle)}`} onClose={onClose}>
      <Alert kind="info">
        Bills are calculated from the society's heads and each flat's area. You are the maker —
        a second officer has to approve before anything is issued.
      </Alert>
      <Input label="Due date" placeholder="YYYY-MM-DD" {...f.bind('dueDate')} />
      <Input label="Note on the bill (optional)" {...f.bind('note')} />
      <Btn block icon={Icons.Bank} onPress={submit} loading={busy}>Draft run</Btn>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  onPanel: { color: 'rgba(255,255,255,0.5)' },
  cycleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
