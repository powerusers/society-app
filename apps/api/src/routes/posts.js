import { Router } from "express";
import { can, createPostSchema, postCommentSchema } from "@gvs/shared";
import { many, one, query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { audit, auditCtx } from "../lib/audit.js";
import { maskPhone } from "../lib/serialize.js";
import { forbidden, notFound, wrap } from "../lib/errors.js";

export const postsRouter = Router();

/* The residents' board, not the committee's. Everyone in the society may post,
   comment and like; what is gated is removing someone else's words, which is
   moderation and belongs to the committee. */
postsRouter.use(requireAuth);

const BOARD = `
  SELECT p.*,
         u.name AS author_name,
         u.phone AS author_phone,
         u.notify AS author_notify,
         f.code AS author_flat,
         COALESCE(l.n, 0)::int AS likes,
         (mine.user_id IS NOT NULL) AS liked_by_me,
         COALESCE(c.comments, '[]'::json) AS comments
    FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    LEFT JOIN flats f ON f.id = u.flat_id
    LEFT JOIN (SELECT post_id, count(*) AS n FROM post_likes GROUP BY post_id) l ON l.post_id = p.id
    LEFT JOIN post_likes mine ON mine.post_id = p.id AND mine.user_id = $2
    LEFT JOIN (
      SELECT pc.post_id,
             json_agg(json_build_object(
               'id', pc.id, 'text', pc.text, 'at', pc.created_at,
               'author', cu.name, 'authorId', pc.author_id
             ) ORDER BY pc.created_at) AS comments
        FROM post_comments pc LEFT JOIN users cu ON cu.id = pc.author_id
       GROUP BY pc.post_id
    ) c ON c.post_id = p.id
   WHERE p.society_id = $1`;

/**
 * One post, from this caller's side.
 *
 * The author's phone follows the same rule as the resident directory: revealed
 * to the committee, to the author themselves, or when that resident has opted
 * in to sharing contact details. Listing a wardrobe for sale is an invitation
 * to be contacted about the wardrobe — it is not consent to publish a personal
 * number to every household in the society, and the reply thread is the channel
 * for everyone else. `contactHidden` says which case this is, so the screen can
 * offer to dial or not rather than guessing from a masked string.
 */
const serialize = (p, viewer) => {
  const reveal = can(viewer.role, "resident.approve")
    || p.author_id === viewer.id
    || !!p.author_notify?.shareContact;
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    body: p.body,
    price: p.price,
    by: p.author_id,
    author: p.author_name || "A former member",
    authorFlat: p.author_flat || null,
    authorPhone: reveal ? p.author_phone : maskPhone(p.author_phone),
    contactHidden: !reveal,
    mine: p.author_id === viewer.id,
    at: p.created_at,
    likes: p.likes,
    liked: p.liked_by_me,
    comments: p.comments || [],
  };
};

postsRouter.get("/", wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const rows = await many(`${BOARD} ORDER BY p.created_at DESC LIMIT $3`,
    [req.user.society_id, req.user.id, limit]);
  res.json({ posts: rows.map((p) => serialize(p, req.user)) });
}));

const loadOne = async (req) => {
  const row = await one(`${BOARD} AND p.id = $3`, [req.user.society_id, req.user.id, req.params.id]);
  if (!row) throw notFound("No such post");
  return row;
};

postsRouter.post("/", validate(createPostSchema), wrap(async (req, res) => {
  const { type, title, body, price } = req.body;
  const created = await one(
    `INSERT INTO posts (society_id, type, title, body, price, author_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    /* A classified with no price given is free, which is a listing people
       actually make; the other types carry no price at all. */
    [req.user.society_id, type, title, body, type === "classified" ? (price ?? 0) : null, req.user.id],
  );
  await audit(auditCtx(req), { action: "post.create", entity: title, entityId: created.id, detail: type });
  req.params.id = created.id;
  res.status(201).json({ post: serialize(await loadOne(req), req.user) });
}));

/** Toggle: tapping again takes the like back, and it counts once either way. */
postsRouter.post("/:id/like", wrap(async (req, res) => {
  await loadOne(req);
  const existing = await one("SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2",
    [req.params.id, req.user.id]);
  if (existing) {
    await query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  } else {
    await query("INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.params.id, req.user.id]);
  }
  res.json({ post: serialize(await loadOne(req), req.user) });
}));

postsRouter.post("/:id/comments", validate(postCommentSchema), wrap(async (req, res) => {
  await loadOne(req);
  await query("INSERT INTO post_comments (post_id, author_id, text) VALUES ($1,$2,$3)",
    [req.params.id, req.user.id, req.body.text]);
  res.status(201).json({ post: serialize(await loadOne(req), req.user) });
}));

/* Your own post is yours to take down — a sold wardrobe should not sit on the
   board for a month. Anyone else's takes the committee's moderation capability,
   which is the only reason that capability exists. */
const mineOrModerator = (row, user) => {
  if (row.author_id === user.id) return;
  if (!can(user.role, "community.moderate")) throw forbidden("That post belongs to another resident");
};

postsRouter.delete("/:id", wrap(async (req, res) => {
  const post = await loadOne(req);
  mineOrModerator(post, req.user);
  await query("DELETE FROM posts WHERE id = $1 AND society_id = $2", [req.params.id, req.user.society_id]);
  await audit(auditCtx(req), { action: "post.delete", entity: post.title, entityId: post.id });
  res.status(204).end();
}));

postsRouter.delete("/:id/comments/:commentId", wrap(async (req, res) => {
  await loadOne(req);
  const row = await one("SELECT * FROM post_comments WHERE id = $1 AND post_id = $2",
    [req.params.commentId, req.params.id]);
  if (!row) throw notFound("No such comment");
  mineOrModerator(row, req.user);
  await query("DELETE FROM post_comments WHERE id = $1", [req.params.commentId]);
  res.json({ post: serialize(await loadOne(req), req.user) });
}));
