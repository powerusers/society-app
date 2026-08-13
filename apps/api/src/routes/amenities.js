import { Router } from "express";
import {
  can, createAmenitySchema, updateAmenitySchema, createBookingSchema,
  decideBookingSchema, createClassSchema,
} from "@gvs/shared";
import { many, one, query } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { conflict, forbidden, notFound, unprocessable, wrap } from "../lib/errors.js";

export const amenitiesRouter = Router();
amenitiesRouter.use(requireAuth);

/* Everyone in the society reads the diary and books; only `amenity.manage` sets
   up what there is to book, and decides the requests that need a decision. */

const amenity = (a) => ({
  id: a.id,
  name: a.name,
  emoji: a.emoji,
  capacity: a.capacity,
  charge: a.charge,
  deposit: a.deposit,
  slots: a.slots || [],
  rules: a.rules,
  requiresApproval: a.requires_approval,
  active: a.active,
});

/**
 * A booking, from this caller's side.
 *
 * The note is written to the committee — "catering vendor arriving at 5 PM",
 * sometimes the reason for a party — so it goes to the committee and to the
 * resident who wrote it. Everyone else needs the slot and the flat, which is
 * what a shared diary is for.
 */
const booking = (b, viewer) => {
  const mine = b.user_id === viewer.id;
  const privileged = mine || can(viewer.role, "amenity.manage");
  return {
    id: b.id,
    amenityId: b.amenity_id,
    amenityName: b.amenity_name ?? null,
    amenityEmoji: b.amenity_emoji ?? null,
    userId: b.user_id,
    userName: b.user_name || "A former resident",
    flatCode: b.flat_code ?? null,
    date: typeof b.booking_date === "string" ? b.booking_date : b.booking_date?.toISOString().slice(0, 10),
    slot: b.slot,
    guests: b.guests,
    amount: b.amount,
    status: b.status,
    note: privileged ? b.note : "",
    reason: b.reason,
    mine,
    at: b.created_at,
  };
};

const BOOKINGS = `
  SELECT b.*, a.name AS amenity_name, a.emoji AS amenity_emoji,
         u.name AS user_name, f.code AS flat_code
    FROM amenity_bookings b
    JOIN amenities a ON a.id = b.amenity_id
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN flats f ON f.id = b.flat_id
   WHERE b.society_id = $1`;

/* ---------------- what there is to book ---------------- */

amenitiesRouter.get("/", wrap(async (req, res) => {
  const rows = await many(
    "SELECT * FROM amenities WHERE society_id = $1 AND active ORDER BY name",
    [req.user.society_id],
  );
  res.json({ amenities: rows.map(amenity) });
}));

amenitiesRouter.post("/", requireCap("amenity.manage"), validate(createAmenitySchema), wrap(async (req, res) => {
  const { name, emoji, capacity, charge, deposit, slots, rules, requiresApproval } = req.body;
  const created = await one(
    `INSERT INTO amenities (society_id, name, emoji, capacity, charge, deposit, slots, rules, requires_approval)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.society_id, name, emoji, capacity, charge, deposit, slots, rules, requiresApproval],
  );
  await audit(auditCtx(req), { action: "amenity.create", entity: name, entityId: created.id });
  res.status(201).json({ amenity: amenity(created) });
}));

const loadAmenity = async (req, id = req.params.id) => {
  const row = await one("SELECT * FROM amenities WHERE id = $1 AND society_id = $2", [id, req.user.society_id]);
  if (!row) throw notFound("No such amenity");
  return row;
};

amenitiesRouter.patch("/:id", requireCap("amenity.manage"), validate(updateAmenitySchema), wrap(async (req, res) => {
  await loadAmenity(req);
  const columns = {
    name: "name", emoji: "emoji", capacity: "capacity", charge: "charge", deposit: "deposit",
    slots: "slots", rules: "rules", requiresApproval: "requires_approval", active: "active",
  };
  const keys = Object.keys(columns).filter((k) => req.body[k] !== undefined);
  const sets = keys.map((k, i) => `${columns[k]} = $${i + 1}`).join(", ");
  const updated = await one(
    `UPDATE amenities SET ${sets} WHERE id = $${keys.length + 1} AND society_id = $${keys.length + 2} RETURNING *`,
    [...keys.map((k) => req.body[k]), req.params.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "amenity.update", entity: updated.name, entityId: updated.id, detail: keys.join(", ") });
  res.json({ amenity: amenity(updated) });
}));

/**
 * Retiring an amenity rather than deleting it.
 *
 * Deleting would take its bookings with it, including the ones already made for
 * next month — residents would find their clubhouse evening simply gone. It
 * disappears from the list; the diary keeps its history.
 */
amenitiesRouter.delete("/:id", requireCap("amenity.manage"), wrap(async (req, res) => {
  const found = await loadAmenity(req);
  await query("UPDATE amenities SET active = false WHERE id = $1 AND society_id = $2",
    [req.params.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "amenity.retire", entity: found.name, entityId: found.id });
  res.status(204).end();
}));

/* ---------------- the diary ---------------- */

amenitiesRouter.get("/bookings", wrap(async (req, res) => {
  /* A month back is enough for "what did we take last month"; everything ahead
     is the part residents are actually planning around. */
  const rows = await many(
    `${BOOKINGS} AND b.booking_date >= (current_date - interval '31 days')
      ORDER BY b.booking_date, b.slot`,
    [req.user.society_id],
  );
  res.json({ bookings: rows.map((b) => booking(b, req.user)) });
}));

amenitiesRouter.post("/bookings", validate(createBookingSchema), wrap(async (req, res) => {
  const { amenityId, date, slot, guests, note } = req.body;
  const found = await loadAmenity(req, amenityId);
  if (!found.active) throw unprocessable("That amenity is no longer bookable");
  if (!(found.slots || []).includes(slot)) throw unprocessable("That is not one of this amenity's slots");
  if (guests > found.capacity) throw unprocessable(`${found.name} holds ${found.capacity} people`);

  /* Compared as dates in the society's own day, not as timestamps: a booking
     made at 11pm for tomorrow must not be refused for being "in the past". */
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) throw unprocessable("That date has passed");

  const status = found.requires_approval ? "pending" : "confirmed";
  const created = await one(
    `INSERT INTO amenity_bookings (society_id, amenity_id, user_id, flat_id, booking_date, slot, guests, note, amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [req.user.society_id, amenityId, req.user.id, req.user.flat_id, date, slot, guests, note, found.charge, status],
  );
  await audit(auditCtx(req), {
    action: "amenity.book", entity: found.name, entityId: created.id, detail: `${date} ${slot}`,
  });
  const row = await one(`${BOOKINGS} AND b.id = $2`, [req.user.society_id, created.id]);
  res.status(201).json({ booking: booking(row, req.user) });
}));

const loadBooking = async (req) => {
  const row = await one(`${BOOKINGS} AND b.id = $2`, [req.user.society_id, req.params.id]);
  if (!row) throw notFound("No such booking");
  return row;
};

/** Approving or refusing a request that needed one. */
amenitiesRouter.post("/bookings/:id/decide", requireCap("amenity.manage"), validate(decideBookingSchema),
  wrap(async (req, res) => {
    const found = await loadBooking(req);
    if (found.status !== "pending") throw conflict("That booking has already been decided");
    const { decision, reason } = req.body;
    await query(
      `UPDATE amenity_bookings SET status = $1, reason = $2, decided_by = $3, decided_at = now()
        WHERE id = $4 AND society_id = $5`,
      [decision, reason, req.user.id, found.id, req.user.society_id],
    );
    await audit(auditCtx(req), {
      action: decision === "confirmed" ? "amenity.approve" : "amenity.reject",
      entity: found.amenity_name, entityId: found.id, detail: `${found.flat_code || ""} ${found.slot}`.trim(),
    });
    res.json({ booking: booking(await loadBooking(req), req.user) });
  }));

/**
 * Cancelling.
 *
 * Yours to cancel, or the committee's. Cancelling frees the slot — the unique
 * index that stops double-booking ignores cancelled rows — so a booking given
 * up on Tuesday is bookable again by a neighbour on Wednesday.
 */
amenitiesRouter.delete("/bookings/:id", wrap(async (req, res) => {
  const found = await loadBooking(req);
  if (found.user_id !== req.user.id && !can(req.user.role, "amenity.manage")) {
    throw forbidden("That booking belongs to another resident");
  }
  if (found.status === "cancelled") throw conflict("That booking is already cancelled");
  await query(
    `UPDATE amenity_bookings SET status = 'cancelled', decided_by = $1, decided_at = now()
      WHERE id = $2 AND society_id = $3`,
    [req.user.id, found.id, req.user.society_id],
  );
  await audit(auditCtx(req), {
    action: "amenity.cancel", entity: found.amenity_name, entityId: found.id,
    detail: `${found.slot}${found.user_id === req.user.id ? "" : " (by the committee)"}`,
  });
  res.status(204).end();
}));

/* ---------------- classes ---------------- */

const CLASSES = `
  SELECT c.*, a.name AS amenity_name,
         COALESCE(e.taken, 0)::int AS enrolled,
         COALESCE(w.waiting, 0)::int AS waiting,
         mine.waitlisted AS my_waitlisted,
         (mine.user_id IS NOT NULL) AS mine
    FROM amenity_classes c
    LEFT JOIN amenities a ON a.id = c.amenity_id
    LEFT JOIN (SELECT class_id, count(*) AS taken FROM class_enrolments WHERE NOT waitlisted GROUP BY class_id) e
           ON e.class_id = c.id
    LEFT JOIN (SELECT class_id, count(*) AS waiting FROM class_enrolments WHERE waitlisted GROUP BY class_id) w
           ON w.class_id = c.id
    LEFT JOIN class_enrolments mine ON mine.class_id = c.id AND mine.user_id = $2
   WHERE c.society_id = $1`;

const klass = (c) => ({
  id: c.id,
  amenityId: c.amenity_id,
  amenityName: c.amenity_name ?? null,
  name: c.name,
  emoji: c.emoji,
  trainer: c.trainer,
  days: c.days,
  time: c.time,
  fee: c.fee,
  seats: c.seats,
  enrolled: c.enrolled,
  waiting: c.waiting,
  /* What this resident's own place is, so the button says "Leave" rather than
     offering to enrol someone who already has a seat. */
  mine: c.mine ? (c.my_waitlisted ? "waitlisted" : "enrolled") : null,
});

amenitiesRouter.get("/classes", wrap(async (req, res) => {
  const rows = await many(`${CLASSES} ORDER BY c.name`, [req.user.society_id, req.user.id]);
  res.json({ classes: rows.map(klass) });
}));

amenitiesRouter.post("/classes", requireCap("amenity.manage"), validate(createClassSchema), wrap(async (req, res) => {
  const { amenityId, name, emoji, trainer, days, time, fee, seats } = req.body;
  if (amenityId) await loadAmenity(req, amenityId);
  const created = await one(
    `INSERT INTO amenity_classes (society_id, amenity_id, name, emoji, trainer, days, time, fee, seats)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [req.user.society_id, amenityId || null, name, emoji, trainer, days, time, fee, seats],
  );
  await audit(auditCtx(req), { action: "class.create", entity: name, entityId: created.id });
  const row = await one(`${CLASSES} AND c.id = $3`, [req.user.society_id, req.user.id, created.id]);
  res.status(201).json({ class: klass(row) });
}));

const loadClass = async (req) => {
  const row = await one(`${CLASSES} AND c.id = $3`, [req.user.society_id, req.user.id, req.params.id]);
  if (!row) throw notFound("No such class");
  return row;
};

amenitiesRouter.delete("/classes/:id", requireCap("amenity.manage"), wrap(async (req, res) => {
  const found = await loadClass(req);
  await query("DELETE FROM amenity_classes WHERE id = $1 AND society_id = $2", [found.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "class.delete", entity: found.name, entityId: found.id });
  res.status(204).end();
}));

/**
 * Enrolling.
 *
 * Past the last seat you join the waitlist rather than being turned away, and
 * the row records which it was — the browser version incremented a seat
 * counter, so tapping "Enrol" five times filled five seats with one resident.
 */
amenitiesRouter.post("/classes/:id/enrol", wrap(async (req, res) => {
  const found = await loadClass(req);
  if (found.mine) throw conflict("You are already on this class");
  const waitlisted = found.enrolled >= found.seats;
  await query(
    "INSERT INTO class_enrolments (class_id, user_id, waitlisted) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    [found.id, req.user.id, waitlisted],
  );
  await audit(auditCtx(req), {
    action: "class.enrol", entity: found.name, entityId: found.id, detail: waitlisted ? "waitlist" : "seat",
  });
  res.status(201).json({ class: klass(await loadClass(req)) });
}));

/**
 * Leaving, which promotes the first person waiting.
 *
 * Without this a freed seat stays empty while somebody sits on a waitlist for
 * it, which is the sort of thing a resident has to ring the office about.
 */
amenitiesRouter.delete("/classes/:id/enrol", wrap(async (req, res) => {
  const found = await loadClass(req);
  if (!found.mine) throw conflict("You are not on this class");
  await query("DELETE FROM class_enrolments WHERE class_id = $1 AND user_id = $2", [found.id, req.user.id]);
  if (found.my_waitlisted === false) {
    await query(
      `UPDATE class_enrolments SET waitlisted = false
        WHERE class_id = $1 AND user_id = (
          SELECT user_id FROM class_enrolments
           WHERE class_id = $1 AND waitlisted ORDER BY enrolled_at LIMIT 1
        )`,
      [found.id],
    );
  }
  res.json({ class: klass(await loadClass(req)) });
}));
