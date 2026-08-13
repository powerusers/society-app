import { Router } from "express";
import { createPollSchema, votePollSchema } from "@gvs/shared";
import { many, one, query, tx } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { notFound, conflict, unprocessable, wrap } from "../lib/errors.js";

export const pollsRouter = Router();
pollsRouter.use(requireAuth);

const ROWS = `
  SELECT p.*,
         u.name AS creator_name,
         (p.closes_at <= now()) AS closed,
         mine.option_id AS my_vote,
         COALESCE(o.options, '[]'::json) AS options,
         COALESCE(t.total, 0)::int AS total
    FROM polls p
    LEFT JOIN users u ON u.id = p.created_by
    LEFT JOIN poll_votes mine ON mine.poll_id = p.id AND mine.user_id = $2
    LEFT JOIN (
      SELECT po.poll_id,
             json_agg(json_build_object('id', po.id, 'text', po.text, 'votes', COALESCE(v.n, 0))
                      ORDER BY po.sort, po.id) AS options
        FROM poll_options po
        LEFT JOIN (SELECT option_id, count(*)::int AS n FROM poll_votes GROUP BY option_id) v
               ON v.option_id = po.id
       GROUP BY po.poll_id
    ) o ON o.poll_id = p.id
    LEFT JOIN (SELECT poll_id, count(*) AS total FROM poll_votes GROUP BY poll_id) t ON t.poll_id = p.id
   WHERE p.society_id = $1`;

/**
 * A poll, from this caller's side.
 *
 * The screen promises "results are visible after you vote", so the tallies are
 * withheld until this caller has voted or the poll has closed. Sending them
 * anyway and hiding them in the UI would make that promise a decoration —
 * anyone reading the network tab could see the running count and time their
 * vote, which is exactly what the rule exists to prevent.
 */
const serialize = (p) => {
  const visible = Boolean(p.my_vote) || p.closed;
  return {
    id: p.id,
    question: p.question,
    createdBy: p.creator_name || "A former member",
    at: p.created_at,
    closesAt: p.closes_at,
    closed: p.closed,
    myVote: p.my_vote || null,
    resultsHidden: !visible,
    total: visible ? p.total : null,
    options: (p.options || []).map((o) => ({ id: o.id, text: o.text, votes: visible ? o.votes : null })),
  };
};

pollsRouter.get("/", wrap(async (req, res) => {
  const rows = await many(`${ROWS} ORDER BY p.closes_at > now() DESC, p.created_at DESC LIMIT 60`,
    [req.user.society_id, req.user.id]);
  res.json({ polls: rows.map(serialize) });
}));

const loadOne = async (req) => {
  const row = await one(`${ROWS} AND p.id = $3`, [req.user.society_id, req.user.id, req.params.id]);
  if (!row) throw notFound("No such poll");
  return row;
};

pollsRouter.post("/", requireCap("poll.write"), validate(createPollSchema), wrap(async (req, res) => {
  const { question, options, days } = req.body;
  const cleaned = options.map((t) => t.trim()).filter(Boolean);
  if (new Set(cleaned.map((t) => t.toLowerCase())).size !== cleaned.length) {
    throw unprocessable("Two options say the same thing");
  }

  const id = await tx(async (c) => {
    const { rows: [poll] } = await c.query(
      `INSERT INTO polls (society_id, question, created_by, closes_at)
       VALUES ($1,$2,$3, now() + ($4 || ' days')::interval) RETURNING id`,
      [req.user.society_id, question, req.user.id, String(days)],
    );
    for (const [i, text] of cleaned.entries()) {
      await c.query("INSERT INTO poll_options (poll_id, text, sort) VALUES ($1,$2,$3)", [poll.id, text, i]);
    }
    return poll.id;
  });

  await audit(auditCtx(req), { action: "poll.create", entity: question, entityId: id });
  req.params.id = id;
  res.status(201).json({ poll: serialize(await loadOne(req)) });
}));

/**
 * One vote per person, enforced by the primary key rather than by a check the
 * API could forget. Voting again moves the vote instead of adding one.
 */
pollsRouter.post("/:id/vote", validate(votePollSchema), wrap(async (req, res) => {
  const poll = await loadOne(req);
  if (poll.closed) throw conflict("This poll has closed");

  const option = await one(
    "SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2",
    [req.body.optionId, poll.id],
  );
  if (!option) throw unprocessable("That option is not on this poll");

  await query(
    `INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1,$2,$3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET option_id = EXCLUDED.option_id, voted_at = now()`,
    [poll.id, req.user.id, option.id],
  );
  res.json({ poll: serialize(await loadOne(req)) });
}));

/** Closing early is how a committee ends a poll without deleting the result. */
pollsRouter.post("/:id/close", requireCap("poll.write"), wrap(async (req, res) => {
  const poll = await loadOne(req);
  if (poll.closed) throw conflict("This poll has already closed");
  await query("UPDATE polls SET closes_at = now() WHERE id = $1 AND society_id = $2",
    [poll.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "poll.close", entity: poll.question, entityId: poll.id });
  res.json({ poll: serialize(await loadOne(req)) });
}));

pollsRouter.delete("/:id", requireCap("poll.write"), wrap(async (req, res) => {
  const poll = await loadOne(req);
  await query("DELETE FROM polls WHERE id = $1 AND society_id = $2", [poll.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "poll.delete", entity: poll.question, entityId: poll.id });
  res.status(204).end();
}));
