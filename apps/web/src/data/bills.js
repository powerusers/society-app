import { useCallback, useMemo } from "react";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useQuery } from "../lib/query";
import { api } from "../lib/api";

/** A resident's own bills, plus the payment flow. */
export function useMyBills() {
  const { live, me, say, sel } = useApp();
  const local = useActions();

  const q = useQuery(
    () => api.get("/api/bills?limit=60").then((r) => r.bills),
    { enabled: live && !!me, deps: [me?.id], initial: [] },
  );

  const localBills = useMemo(() => sel.billsOf(me?.flat || ""), [sel, me]);
  const bills = live ? (q.data || []) : localBills;

  const pay = useCallback(async (bill, mode) => {
    if (!live) return { ok: true, payment: local.payBill(bill, mode) };
    try {
      const { payment } = await api.post(`/api/bills/${bill.id}/pay`, { mode });
      await q.refetch();
      return { ok: true, payment };
    } catch (err) {
      say(err.message, "bad");
      return { ok: false, error: err };
    }
  }, [live, local, q, say]);

  /* In demo mode a payment lives in a separate collection; the API returns it
     with the bill. One lookup either way. */
  const paymentFor = useCallback(async (bill) => {
    if (!live) return sel.paymentOf(bill.id) || null;
    const { payment } = await api.get(`/api/bills/${bill.id}`);
    return payment;
  }, [live, sel]);

  return {
    bills,
    loading: live ? q.loading && !q.data?.length : false,
    error: live ? q.error : null,
    refetch: q.refetch,
    pay,
    paymentFor,
    dues: bills.filter((b) => b.status !== "paid").reduce((s, b) => s + Number(b.total), 0),
  };
}

/** The committee's view of a billing cycle, including the maker-checker state. */
export function useBillingRun(cycle) {
  const { live, say, db, can } = useApp();
  const local = useActions();

  const runQ = useQuery(
    () => api.get(`/api/bills/runs/${cycle}`),
    { enabled: live && !!cycle && can("accounts.view"), deps: [cycle] },
  );

  const billsQ = useQuery(
    () => api.get(`/api/bills?cycle=${cycle}&limit=200`).then((r) => r.bills),
    { enabled: live && !!cycle, deps: [cycle], initial: [] },
  );

  const localBills = useMemo(() => db.bills.filter((b) => b.cycle === cycle), [db.bills, cycle]);
  const bills = live ? (billsQ.data || []) : localBills;

  const localDrafts = localBills.filter((b) => b.status === "pending-approval");
  const run = live ? runQ.data : {
    cycle,
    bills: localBills.length,
    drafts: localDrafts.length,
    paid: localBills.filter((b) => b.status === "paid").length,
    billed: localBills.reduce((s, b) => s + b.total, 0),
    collected: localBills.filter((b) => b.status === "paid").reduce((s, b) => s + b.total, 0),
    makerId: localDrafts[0]?.makerId || null,
  };

  const reload = useCallback(async () => {
    if (!live) return;
    await Promise.all([runQ.refetch(), billsQ.refetch()]);
  }, [live, runQ, billsQ]);

  const generate = useCallback(async () => {
    if (!live) return { ok: !!local.generateBills(cycle) };
    try {
      const r = await api.post("/api/bills/runs", { cycle });
      await reload();
      say(`${r.drafted} bills drafted — waiting for approval.`);
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, cycle, reload, say]);

  const approve = useCallback(async () => {
    if (!live) { local.approveRun(cycle); return { ok: true }; }
    try {
      const r = await api.post(`/api/bills/runs/${cycle}/approve`, {});
      await reload();
      say(`${r.issued} bills approved and sent to residents.`);
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, cycle, reload, say]);

  const reject = useCallback(async (reason) => {
    if (!live) { local.rejectRun(cycle, reason); return { ok: true }; }
    try {
      await api.del(`/api/bills/runs/${cycle}`);
      await reload();
      say("Draft run rejected and removed.", "bad");
      return { ok: true };
    } catch (err) { say(err.message, "bad"); return { ok: false, error: err }; }
  }, [live, local, cycle, reload, say]);

  return {
    bills,
    run,
    loading: live ? (billsQ.loading && !billsQ.data?.length) : false,
    error: live ? (billsQ.error || runQ.error) : null,
    reload,
    generate,
    approve,
    reject,
    /* The server states who may approve and why not; demo mode falls back to the
       same shared rule the API uses. */
    canApprove: live ? !!run?.canApprove : undefined,
    approvalBlockedBy: live ? run?.approvalBlockedBy : undefined,
  };
}
