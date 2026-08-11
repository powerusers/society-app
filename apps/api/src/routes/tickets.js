import { Router } from "express";
import {
  can, createTicketSchema, updateTicketSchema, ticketCommentSchema, rateTicketSchema,
  listQuerySchema, slaDueAt,
} from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, validateQuery } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { ticket as toTicket, comment as toComment } from "../lib/serialize.js";
import { societySettings } from "./visitors.js";
import { conflict, forbidden, notFound, wrap } from "../lib/errors.js";

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

const SELECT = `
  SELECT t.*, f.code AS flat_code,
         r.name AS raised_by_name, a.name AS assigned_to_name
    FROM tickets t
    LEFT JOIN flats f ON f.id = t.flat_id
    LEFT JOIN users r ON r.id = t.raised_by
    LEFT JOIN users a ON a.id = t.assigned_to`;

const visibilityClause = (user, params) => {
  if (can(user.role, "helpdesk.manage")) {
    // staff see what is theirs or unassigned; committee and admin see everything
    if (user.role === "staff") {
      params.push(user.id);
      return `(t.assigned_to = $${params.length} OR t.assigned_to IS NULL)`;
    }
    return "true";
  }
  params.push(user.flat_id ?? null);
  return `t.flat_id = $${params.length}`;
};

ticketsRouter.get("/", validateQuery(listQuerySchema), wrap(async (req, res) => {
  const { limit, offset, status } = req.validQuery;
  const params = [req.user.society_id];
  const where = ["t.society_id = $1", visibilityClause(req.user, params)];

  if (status) { params.push(status.split(",")); where.push(`t.status = ANY($${params.length})`); }

  params.push(limit, offset);
  const rows = await many(
    `${SELECT} WHERE ${where.join(" AND ")}
      ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  res.json({ tickets: rows.map(toTicket) });
}));

ticketsRouter.post("/", validate(createTicketSchema), wrap(async (req, res) => {
  const b = req.body;

  let flatId = req.user.flat_id;
  if (b.flatCode) {
    if (b.flatCode !== req.user.flat_code && !can(req.user.role, "helpdesk.manage")) {
      throw forbidden("You can only raise tickets for your own flat");
    }
    const flat = await one("SELECT id FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, b.flatCode]);
    if (!flat) throw notFound(`Flat ${b.flatCode} does not exist`);
    flatId = flat.id;
  }

  const settings = await societySettings(req.user.society_id);

  const created = await tx(async (client) => {
    /* A sequence hands out each reference exactly once — counting existing rows
       would let two simultaneous submissions claim the same number. */
    const { rows: [{ n }] } = await client.query("SELECT nextval('ticket_ref_seq')::int AS n");

    const { rows } = await client.query(
      `INSERT INTO tickets (society_id, ref, flat_id, title, body, category, priority, source, raised_by, sla_due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        req.user.society_id, `HD-${n}`, flatId, b.title, b.body, b.category, b.priority, b.source,
        req.user.id, slaDueAt(b.priority, settings.slaHours),
      ],
    );
    await audit(auditCtx(req), {
      action: "ticket.create", entity: `HD-${n}`, entityId: rows[0].id, detail: b.title,
    }, client);
    return rows[0];
  });

  const full = await one(`${SELECT} WHERE t.id = $1`, [created.id]);
  res.status(201).json({ ticket: toTicket(full) });
}));

ticketsRouter.get("/:id", wrap(async (req, res) => {
  const t = await loadVisible(req);
  const comments = await many(
    `SELECT c.*, u.name AS author_name FROM ticket_comments c
       LEFT JOIN users u ON u.id = c.author_id
      WHERE c.ticket_id = $1 ORDER BY c.created_at ASC`,
    [t.id],
  );
  res.json({ ticket: { ...toTicket(t), comments: comments.map(toComment) } });
}));

ticketsRouter.patch("/:id", validate(updateTicketSchema), wrap(async (req, res) => {
  const t = await loadVisible(req);
  if (!can(req.user.role, "helpdesk.manage")) throw forbidden("Only the helpdesk can change a ticket's state");

  const patch = {};
  if (req.body.status) {
    patch.status = req.body.status;
    if (req.body.status === "resolved") patch.resolved_at = new Date();
  }
  if (req.body.priority) patch.priority = req.body.priority;
  if ("assignedTo" in req.body) {
    if (req.body.assignedTo) {
      const assignee = await one(
        "SELECT id, role FROM users WHERE id = $1 AND society_id = $2",
        [req.body.assignedTo, req.user.society_id],
      );
      if (!assignee) throw notFound("No such user to assign to");
      if (!can(assignee.role, "helpdesk.manage") && assignee.role !== "guard") {
        throw conflict("Tickets can only be assigned to staff, guards or the committee");
      }
    }
    patch.assigned_to = req.body.assignedTo;
    // picking up an untouched ticket moves it along without a second call
    if (req.body.assignedTo && !req.body.status && t.status === "open") patch.status = "in-progress";
  }

  const cols = Object.keys(patch);
  const params = [...cols.map((c) => patch[c]), t.id];
  const updated = await tx(async (client) => {
    const { rows } = await client.query(
      `UPDATE tickets SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${params.length} RETURNING id`,
      params,
    );
    await audit(auditCtx(req), {
      action: "ticket.update", entity: t.ref, entityId: t.id,
      detail: cols.map((c) => `${c}=${patch[c]}`).join(", "),
    }, client);
    return rows[0];
  });

  res.json({ ticket: toTicket(await one(`${SELECT} WHERE t.id = $1`, [updated.id])) });
}));

ticketsRouter.post("/:id/comments", validate(ticketCommentSchema), wrap(async (req, res) => {
  const t = await loadVisible(req);
  const { rows } = await query(
    `INSERT INTO ticket_comments (ticket_id, author_id, text) VALUES ($1,$2,$3) RETURNING *`,
    [t.id, req.user.id, req.body.text],
  );
  res.status(201).json({ comment: toComment({ ...rows[0], author_name: req.user.name }) });
}));

/** Only the resident who raised it may rate, and only once it is resolved. */
ticketsRouter.post("/:id/rating", validate(rateTicketSchema), wrap(async (req, res) => {
  const t = await loadVisible(req);
  if (t.raised_by !== req.user.id) throw forbidden("Only the resident who raised the ticket can rate it");
  if (t.status !== "resolved") throw conflict("Rate the ticket once it has been resolved");
  if (t.rating) throw conflict("This ticket has already been rated");

  const updated = await tx(async (client) => {
    const { rows } = await client.query(
      "UPDATE tickets SET rating = $1, status = 'closed' WHERE id = $2 RETURNING id",
      [req.body.rating, t.id],
    );
    await audit(auditCtx(req), { action: "ticket.rate", entity: t.ref, entityId: t.id, detail: `${req.body.rating}/5` }, client);
    return rows[0];
  });
  res.json({ ticket: toTicket(await one(`${SELECT} WHERE t.id = $1`, [updated.id])) });
}));

async function loadVisible(req) {
  const t = await one(`${SELECT} WHERE t.id = $1 AND t.society_id = $2`, [req.params.id, req.user.society_id]);
  if (!t) throw notFound("No such ticket");
  const mine = t.flat_id && t.flat_id === req.user.flat_id;
  if (!mine && !can(req.user.role, "helpdesk.manage")) throw forbidden("That ticket belongs to another flat");
  return t;
}
