import { Router } from "express";
import {
  can, canApproveRun, canTransitionBill, computeBill, generateRunSchema, payBillSchema,
  listQuerySchema, narrationFor, receiptNoFor, settlementDueAt,
} from "@gvs/shared";
import { many, one, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate, validateQuery } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { bill as toBill, payment as toPayment } from "../lib/serialize.js";
import { societySettings } from "./visitors.js";
import { conflict, forbidden, notFound, wrap, badRequest } from "../lib/errors.js";

export const billsRouter = Router();
billsRouter.use(requireAuth);

const SELECT = `
  SELECT b.*, f.code AS flat_code
    FROM bills b JOIN flats f ON f.id = b.flat_id`;

billsRouter.get("/", validateQuery(listQuerySchema), wrap(async (req, res) => {
  const { limit, offset, status, cycle, flatCode } = req.validQuery;
  const params = [req.user.society_id];
  const where = ["b.society_id = $1"];

  // Residents see only their own flat's bills, whatever they ask for.
  if (!can(req.user.role, "accounts.view")) {
    if (!req.user.flat_id) return res.json({ bills: [] });
    params.push(req.user.flat_id);
    where.push(`b.flat_id = $${params.length}`);
    // an unapproved draft is not a bill yet, so residents never see one
    where.push(`b.status <> 'pending-approval'`);
  } else if (flatCode) {
    params.push(flatCode);
    where.push(`f.code = $${params.length}`);
  }

  if (cycle) { params.push(cycle); where.push(`b.cycle = $${params.length}`); }
  if (status) { params.push(status.split(",")); where.push(`b.status = ANY($${params.length})`); }

  params.push(limit, offset);
  const rows = await many(
    `${SELECT} WHERE ${where.join(" AND ")}
      ORDER BY b.cycle DESC, f.code ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ bills: rows.map(toBill) });
}));

/**
 * Maker step. Creates one draft per flat that does not already have a bill for
 * the cycle, computed with the shared calculator so the preview the committee
 * saw and the bill the resident gets are the same numbers.
 */
billsRouter.post("/runs", requireCap("billing.make"), validate(generateRunSchema), wrap(async (req, res) => {
  const { cycle } = req.body;

  const existingApproved = await one(
    "SELECT count(*)::int AS n FROM bills WHERE society_id = $1 AND cycle = $2 AND status <> 'pending-approval'",
    [req.user.society_id, cycle],
  );
  if (existingApproved.n > 0) throw conflict(`${existingApproved.n} bills have already been issued for ${cycle}`);

  const heads = await many(
    "SELECT code AS id, name, basis, rate, gst FROM charge_heads WHERE society_id = $1 AND active ORDER BY sort",
    [req.user.society_id],
  );
  if (!heads.length) throw badRequest("No charge heads are configured for this society");

  const flats = await many("SELECT * FROM flats WHERE society_id = $1 ORDER BY code", [req.user.society_id]);

  const result = await tx(async (client) => {
    const { rows: skip } = await client.query("SELECT flat_id FROM bills WHERE society_id = $1 AND cycle = $2", [req.user.society_id, cycle]);
    const already = new Set(skip.map((r) => r.flat_id));

    let created = 0;
    for (const f of flats) {
      if (already.has(f.id)) continue;
      const { items, subtotal, gst, total } = computeBill(f, heads, f.parking_slots);
      await client.query(
        `INSERT INTO bills (society_id, flat_id, cycle, items, subtotal, gst, total, due_date, status, maker_id)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,'pending-approval',$9)`,
        [req.user.society_id, f.id, cycle, JSON.stringify(items), subtotal, gst, total, `${cycle}-10`, req.user.id],
      );
      created++;
    }
    await audit(auditCtx(req), {
      action: "billing.generate", entity: `Run ${cycle}`,
      detail: `${created} draft bills prepared by ${req.user.name}`,
    }, client);
    return created;
  });

  if (!result) throw conflict(`Drafts for ${cycle} already exist`);
  res.status(201).json({ cycle, drafted: result, status: "pending-approval" });
}));

billsRouter.get("/runs/:cycle", requireCap("accounts.view"), wrap(async (req, res) => {
  const row = await one(
    `SELECT cycle,
            count(*)::int AS bills,
            count(*) FILTER (WHERE status = 'pending-approval')::int AS drafts,
            count(*) FILTER (WHERE status = 'paid')::int AS paid,
            sum(total) AS billed,
            sum(total) FILTER (WHERE status = 'paid') AS collected,
            min(maker_id::text) AS maker_id
       FROM bills WHERE society_id = $1 AND cycle = $2 GROUP BY cycle`,
    [req.user.society_id, req.params.cycle],
  );
  if (!row) return res.json({ cycle: req.params.cycle, bills: 0, drafts: 0 });

  const approval = canApproveRun(req.user, { makerId: row.maker_id });
  res.json({ ...row, billed: row.billed ?? 0, collected: row.collected ?? 0, canApprove: approval.ok, approvalBlockedBy: approval.reason ?? null });
}));

/**
 * Checker step. The capability alone is not enough — whoever prepared the run
 * is refused, and the database carries the same constraint as a backstop.
 */
billsRouter.post("/runs/:cycle/approve", requireCap("billing.approve"), wrap(async (req, res) => {
  const cycle = req.params.cycle;
  const drafts = await many(
    "SELECT id, maker_id, total FROM bills WHERE society_id = $1 AND cycle = $2 AND status = 'pending-approval'",
    [req.user.society_id, cycle],
  );
  if (!drafts.length) throw notFound(`No draft bills are waiting for ${cycle}`);

  const verdict = canApproveRun(req.user, { makerId: drafts[0].maker_id });
  if (!verdict.ok) {
    throw forbidden(
      verdict.reason === "maker_is_checker"
        ? "You prepared this run, so you cannot approve it. It needs a second officer."
        : "Your role cannot approve billing runs",
      { reason: verdict.reason },
    );
  }

  const issued = await tx(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE bills SET status = 'issued', approved_by = $1, approved_at = now(), issued_at = now()
        WHERE society_id = $2 AND cycle = $3 AND status = 'pending-approval'`,
      [req.user.id, req.user.society_id, cycle],
    );
    await audit(auditCtx(req), {
      action: "billing.approve", entity: `Run ${cycle}`,
      detail: `${rowCount} bills approved and issued by ${req.user.name}`,
    }, client);
    return rowCount;
  });

  res.json({ cycle, issued });
}));

billsRouter.delete("/runs/:cycle", requireCap("billing.approve"), wrap(async (req, res) => {
  const removed = await tx(async (client) => {
    const { rowCount } = await client.query(
      "DELETE FROM bills WHERE society_id = $1 AND cycle = $2 AND status = 'pending-approval'",
      [req.user.society_id, req.params.cycle],
    );
    await audit(auditCtx(req), {
      action: "billing.reject", entity: `Run ${req.params.cycle}`, detail: `${rowCount} drafts discarded`,
    }, client);
    return rowCount;
  });
  if (!removed) throw notFound("No draft run to reject");
  res.json({ cycle: req.params.cycle, rejected: removed });
}));

/** Records a payment and the matching ledger entry in one transaction. */
billsRouter.post("/:id/pay", validate(payBillSchema), wrap(async (req, res) => {
  const bill = await one(`${SELECT} WHERE b.id = $1 AND b.society_id = $2`, [req.params.id, req.user.society_id]);
  if (!bill) throw notFound("No such bill");

  const mine = req.user.flat_id === bill.flat_id;
  if (!mine && !can(req.user.role, "accounts.write")) throw forbidden("You can only pay your own flat's bills");
  if (!canTransitionBill(bill.status, "paid")) {
    throw conflict(bill.status === "paid" ? "This bill is already paid" : `A ${bill.status} bill cannot be paid`);
  }

  const settings = await societySettings(req.user.society_id);
  const paidAt = new Date();

  const created = await tx(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO payments (society_id, bill_id, flat_id, amount, mode, txn_id, receipt_no, narration, paid_at, settled_at, paid_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.user.society_id, bill.id, bill.flat_id, bill.total, req.body.mode,
        `T${Date.now().toString().slice(-10)}`,
        receiptNoFor({ cycle: bill.cycle, flatCode: bill.flat_code }),
        narrationFor({ mode: req.body.mode, flatCode: bill.flat_code, cycle: bill.cycle }),
        paidAt, settlementDueAt(paidAt, settings.settlementMins), req.user.id,
      ],
    );
    await client.query("UPDATE bills SET status = 'paid', paid_at = $1 WHERE id = $2", [paidAt, bill.id]);
    await client.query(
      `INSERT INTO ledger_entries (society_id, entry_date, head, type, amount, flat_id, mode, note, ref_id, created_by)
       VALUES ($1,$2,'Maintenance income','income',$3,$4,$5,$6,$7,$8)`,
      [req.user.society_id, paidAt, bill.total, bill.flat_id, req.body.mode,
       `Bill ${bill.cycle} · ${bill.flat_code}`, rows[0].id, req.user.id],
    );
    await audit(auditCtx(req), {
      action: "payment.receive", entity: rows[0].receipt_no, entityId: rows[0].id,
      detail: `${bill.flat_code} · ${bill.cycle} · ${bill.total}`,
    }, client);
    return rows[0];
  });

  res.status(201).json({ payment: toPayment({ ...created, flat_code: bill.flat_code }) });
}));

billsRouter.get("/:id", wrap(async (req, res) => {
  const bill = await one(`${SELECT} WHERE b.id = $1 AND b.society_id = $2`, [req.params.id, req.user.society_id]);
  if (!bill) throw notFound("No such bill");
  if (req.user.flat_id !== bill.flat_id && !can(req.user.role, "accounts.view")) {
    throw forbidden("That bill belongs to another flat");
  }
  const payment = await one("SELECT * FROM payments WHERE bill_id = $1", [bill.id]);
  res.json({ bill: toBill(bill), payment: payment ? toPayment({ ...payment, flat_code: bill.flat_code }) : null });
}));
