import { Router } from "express";
import { createNoticeSchema, updateNoticeSchema, noticeCommentSchema, noticeReactionSchema } from "@gvs/shared";
import { many, one, query } from "../db/pool.js";
import { requireAuth, requireCap } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { notFound, wrap } from "../lib/errors.js";

export const noticesRouter = Router();

/* Reading the board, commenting and reacting are open to every member of the
   society. Posting, pinning and removing are not — those carry the committee's
   voice, so they sit behind notice.write. */
noticesRouter.use(requireAuth);

/**
 * The board, newest first with pinned notices on top.
 *
 * Comments, reaction tallies and read counts are aggregated in the query rather
 * than fetched per notice: a board of fifty would otherwise be fifty round
 * trips, and the screen renders all of it at once anyway.
 */
const BOARD = `
  SELECT n.*,
         u.name AS author_name,
         COALESCE(r.count, 0)::int AS read_count,
         (mine.user_id IS NOT NULL) AS read_by_me,
         COALESCE(c.comments, '[]'::json) AS comments,
         COALESCE(x.reactions, '{}'::json) AS reactions,
         COALESCE(m.mine, '[]'::json) AS my_reactions
    FROM notices n
    LEFT JOIN users u ON u.id = n.author_id
    LEFT JOIN (SELECT notice_id, count(*) AS count FROM notice_reads GROUP BY notice_id) r
           ON r.notice_id = n.id
    LEFT JOIN notice_reads mine ON mine.notice_id = n.id AND mine.user_id = $2
    LEFT JOIN (
      SELECT nc.notice_id,
             json_agg(json_build_object(
               'id', nc.id, 'body', nc.body, 'at', nc.created_at,
               'author', cu.name, 'authorId', nc.author_id
             ) ORDER BY nc.created_at) AS comments
        FROM notice_comments nc LEFT JOIN users cu ON cu.id = nc.author_id
       GROUP BY nc.notice_id
    ) c ON c.notice_id = n.id
    LEFT JOIN (
      SELECT notice_id, json_object_agg(emoji, n) AS reactions
        FROM (SELECT notice_id, emoji, count(*)::int AS n FROM notice_reactions GROUP BY notice_id, emoji) t
       GROUP BY notice_id
    ) x ON x.notice_id = n.id
    LEFT JOIN (
      SELECT notice_id, json_agg(emoji) AS mine FROM notice_reactions WHERE user_id = $2 GROUP BY notice_id
    ) m ON m.notice_id = n.id
   WHERE n.society_id = $1`;

const serialize = (n) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  author: n.author_name || "A former member",
  authorId: n.author_id,
  priority: n.priority,
  pinned: n.pinned,
  at: n.created_at,
  comments: n.comments || [],
  reactions: n.reactions || {},
  myReactions: n.my_reactions || [],
  readCount: n.read_count,
  read: n.read_by_me,
});

noticesRouter.get("/", wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const rows = await many(
    `${BOARD} ORDER BY n.pinned DESC, n.created_at DESC LIMIT $3`,
    [req.user.society_id, req.user.id, limit],
  );
  res.json({ notices: rows.map(serialize) });
}));

const loadOne = async (req) => {
  const row = await one(`${BOARD} AND n.id = $3`, [req.user.society_id, req.user.id, req.params.id]);
  if (!row) throw notFound("No such notice");
  return row;
};

noticesRouter.post("/", requireCap("notice.write"), validate(createNoticeSchema), wrap(async (req, res) => {
  const { kind, title, body, priority, pinned } = req.body;
  const created = await one(
    `INSERT INTO notices (society_id, kind, title, body, author_id, priority, pinned)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.user.society_id, kind, title, body, req.user.id, priority, pinned],
  );
  /* The author has read their own notice; counting them as unread would show
     the committee a badge for the thing they just wrote. */
  await query("INSERT INTO notice_reads (notice_id, user_id) VALUES ($1,$2)", [created.id, req.user.id]);
  await audit(auditCtx(req), { action: "notice.post", entity: title, entityId: created.id, detail: kind });

  req.params.id = created.id;
  res.status(201).json({ notice: serialize(await loadOne(req)) });
}));

noticesRouter.patch("/:id", requireCap("notice.write"), validate(updateNoticeSchema), wrap(async (req, res) => {
  await loadOne(req);
  const fields = ["kind", "title", "body", "priority", "pinned"].filter((k) => req.body[k] !== undefined);
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
  await query(
    `UPDATE notices SET ${sets} WHERE id = $${fields.length + 1} AND society_id = $${fields.length + 2}`,
    [...fields.map((f) => req.body[f]), req.params.id, req.user.society_id],
  );
  await audit(auditCtx(req), { action: "notice.edit", entityId: req.params.id, detail: fields.join(", ") });
  res.json({ notice: serialize(await loadOne(req)) });
}));

noticesRouter.delete("/:id", requireCap("notice.write"), wrap(async (req, res) => {
  const notice = await loadOne(req);
  await query("DELETE FROM notices WHERE id = $1 AND society_id = $2", [req.params.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "notice.delete", entity: notice.title, entityId: req.params.id });
  res.status(204).end();
}));

/* Opening a notice marks it read. Idempotent, because a resident scrolling the
   board past the same notice twice has not read it twice. */
noticesRouter.post("/:id/read", wrap(async (req, res) => {
  await loadOne(req);
  await query(
    "INSERT INTO notice_reads (notice_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [req.params.id, req.user.id],
  );
  res.status(204).end();
}));

noticesRouter.post("/:id/comments", validate(noticeCommentSchema), wrap(async (req, res) => {
  await loadOne(req);
  await query(
    "INSERT INTO notice_comments (notice_id, author_id, body) VALUES ($1,$2,$3)",
    [req.params.id, req.user.id, req.body.body],
  );
  res.status(201).json({ notice: serialize(await loadOne(req)) });
}));

/** Toggles: tapping the same reaction again takes it back. */
noticesRouter.post("/:id/reactions", validate(noticeReactionSchema), wrap(async (req, res) => {
  await loadOne(req);
  const existing = await one(
    "SELECT 1 FROM notice_reactions WHERE notice_id = $1 AND user_id = $2 AND emoji = $3",
    [req.params.id, req.user.id, req.body.emoji],
  );
  if (existing) {
    await query("DELETE FROM notice_reactions WHERE notice_id = $1 AND user_id = $2 AND emoji = $3",
      [req.params.id, req.user.id, req.body.emoji]);
  } else {
    await query("INSERT INTO notice_reactions (notice_id, user_id, emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [req.params.id, req.user.id, req.body.emoji]);
  }
  res.json({ notice: serialize(await loadOne(req)) });
}));
