import { Router } from "express";
import { can, isFlatMember, createVehicleSchema, updateVehicleSchema, normalisePlate } from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { forbidden, notFound, unprocessable, wrap } from "../lib/errors.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const ROWS = `
  SELECT v.*, f.code AS flat_code, f.parking_slots, u.name AS owner_name
    FROM vehicles v
    LEFT JOIN flats f ON f.id = v.flat_id
    LEFT JOIN users u ON u.id = v.owner_id
   WHERE v.society_id = $1`;

/**
 * The plate is stored normalised, but shown the way it is written on the car —
 * so the register reads like the windscreen rather than like a database.
 */
const pretty = (n) => (n.length === 10 ? `${n.slice(0, 2)}-${n.slice(2, 4)}-${n.slice(4, 6)}-${n.slice(6)}` : n);

const serialize = (v) => ({
  id: v.id,
  kind: v.kind,
  model: v.model,
  number: pretty(v.number),
  slot: v.slot || "",
  sticker: String(v.sticker_no).padStart(4, "0"),
  flatCode: v.flat_code ?? null,
  ownerId: v.owner_id,
  ownerName: v.owner_name || "A former resident",
  at: v.created_at,
});

/**
 * The register.
 *
 * A resident sees their own flat's vehicles. Anyone who works the gate sees all
 * of them, because recognising a car at the barrier is the whole point of the
 * register existing.
 */
vehiclesRouter.get("/", wrap(async (req, res) => {
  const all = can(req.user.role, "gate.view");
  const rows = all
    ? await many(`${ROWS} ORDER BY f.code NULLS LAST, v.created_at`, [req.user.society_id])
    : await many(`${ROWS} AND v.flat_id = $2 ORDER BY v.created_at`, [req.user.society_id, req.user.flat_id]);
  res.json({ vehicles: rows.map(serialize), scope: all ? "society" : "flat" });
}));

/**
 * Plate lookup for the gate.
 *
 * What a guard actually does with the register: a car is at the barrier and
 * they need to know whose it is. Matching on the normalised plate means it
 * works whichever way the number was typed in, at either end.
 */
vehiclesRouter.get("/plate/:number", requireCap("gate.view"), wrap(async (req, res) => {
  const row = await one(`${ROWS} AND v.number = $2`, [req.user.society_id, normalisePlate(req.params.number)]);
  if (!row) throw notFound("No vehicle on the register with that number");
  res.json({ vehicle: serialize(row) });
}));

const loadOne = async (req) => {
  const row = await one(`${ROWS} AND v.id = $2`, [req.user.society_id, req.params.id]);
  if (!row) throw notFound("No such vehicle");
  return row;
};

/** Yours, or the committee's — the same rule the rest of the flat's data uses. */
const mineOrManager = (row, user) => {
  if (isFlatMember(user, row.flat_code)) return;
  if (!can(user.role, "settings.write") && !can(user.role, "resident.approve")) {
    throw forbidden("That vehicle belongs to another flat");
  }
};

vehiclesRouter.post("/", validate(createVehicleSchema), wrap(async (req, res) => {
  const { kind, model, slot } = req.body;
  const number = normalisePlate(req.body.number);

  /* A resident registers against the flat they live in. Only someone who can
     approve residents may name a different one — otherwise a plate could be
     parked on a neighbour's register, which is how a parking dispute starts. */
  const forOther = req.body.flatCode && req.body.flatCode !== req.user.flat;
  if (forOther && !can(req.user.role, "resident.approve")) {
    throw forbidden("You can only register a vehicle against your own flat");
  }
  const flatCode = forOther ? req.body.flatCode : req.user.flat;
  if (!flatCode) throw unprocessable("Vehicles are registered against a flat, and your account has none");

  const flat = await one("SELECT * FROM flats WHERE society_id = $1 AND code = $2", [req.user.society_id, flatCode]);
  if (!flat) throw unprocessable(`Flat ${flatCode} is not on the society's register`);

  const vehicle = await tx(async (c) => {
    /* Two vehicles registered at the same instant would otherwise read the same
       maximum and both try for the same sticker. The unique constraint would
       catch it; the lock means the second one gets the next number instead of
       an error it did nothing to deserve. */
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`vehicle_sticker:${req.user.society_id}`]);

    if (slot) {
      const allotted = Number(flat.parking_slots);
      const { rows: [held] } = await c.query(
        "SELECT count(*)::int AS n FROM vehicles WHERE society_id = $1 AND flat_id = $2 AND slot <> ''",
        [req.user.society_id, flat.id],
      );
      /* The society allotted this flat a number of slots; claiming more of them
         in the app is how the register stops matching the car park. */
      if (held.n >= allotted) {
        throw unprocessable(allotted === 0
          ? `Flat ${flat.code} has no allotted parking slot`
          : `Flat ${flat.code} has ${allotted} allotted slot${allotted === 1 ? "" : "s"}, and ${held.n === 1 ? "one is" : `${held.n} are`} already claimed`);
      }
    }

    const { rows: [next] } = await c.query(
      "SELECT COALESCE(max(sticker_no), 0) + 1 AS n FROM vehicles WHERE society_id = $1",
      [req.user.society_id],
    );
    const { rows: [row] } = await c.query(
      `INSERT INTO vehicles (society_id, flat_id, owner_id, kind, model, number, slot, sticker_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.user.society_id, flat.id, forOther ? null : req.user.id, kind, model, number, slot || "", next.n],
    );
    return row;
  });

  await audit(auditCtx(req), {
    action: "vehicle.add", entity: pretty(number), entityId: vehicle.id,
    detail: [kind, flatCode, slot && `slot ${slot}`].filter(Boolean).join(" · "),
  });
  req.params.id = vehicle.id;
  res.status(201).json({ vehicle: serialize(await loadOne(req)) });
}));

/** Changing the slot, chiefly — the plate itself is not editable, it is re-registered. */
vehiclesRouter.patch("/:id", validate(updateVehicleSchema), wrap(async (req, res) => {
  const found = await loadOne(req);
  mineOrManager(found, req.user);

  const keys = ["model", "slot"].filter((k) => req.body[k] !== undefined);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  await query(
    `UPDATE vehicles SET ${sets} WHERE id = $${keys.length + 1} AND society_id = $${keys.length + 2}`,
    [...keys.map((k) => req.body[k]), found.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "vehicle.update", entity: pretty(found.number), entityId: found.id, detail: keys.join(", ") });
  res.json({ vehicle: serialize(await loadOne(req)) });
}));

vehiclesRouter.delete("/:id", wrap(async (req, res) => {
  const found = await loadOne(req);
  mineOrManager(found, req.user);
  await query("DELETE FROM vehicles WHERE id = $1 AND society_id = $2", [found.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "vehicle.remove", entity: pretty(found.number), entityId: found.id, detail: found.flat_code });
  res.status(204).end();
}));
