import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Sheet, Empty, Segmented, Bar, Avatar, TextArea, Input, Select, Alert, SkeletonList } from "../components/ui";
import { NoticeCard } from "../components/entities";
import { PostNoticeSheet } from "../components/sheets";
import { useApp } from "../store";
import { useNotices } from "../data/notices";
import { usePolls } from "../data/polls";
import { useForum } from "../data/forum";
import { ago, fmtDate, inr, pct } from "../lib/format";

const TABS = [
  { value: "notices", label: "Notices" },
  { value: "polls", label: "Polls" },
  { value: "forum", label: "Discuss" },
  { value: "market", label: "Market" },
];

export default function Community({ nav }) {
  const { can } = useApp();
  const {
    notices, unread, loading: noticesLoading, error: noticesError, refetch: refetchNotices,
    create: postNotice, markRead, react, comment,
  } = useNotices();
  const {
    polls, loading: pollsLoading, error: pollsError, refetch: refetchPolls,
    vote, create: createPoll, close: closePoll,
  } = usePolls();
  const forum = useForum();
  const { create: createPost } = forum;
  const [tab, setTab] = useState("notices");
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(null);

  /* The sheet renders from the board rather than the row that opened it, so a
     comment or a reaction shows up without closing and reopening. */
  const openNotice = open ? notices.find((n) => n.id === open.id) || open : null;

  return (
    <>
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === "notices" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <p className="muted">{notices.length} notices · {unread} unread</p>
            {can("notice.write") && <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("post")}>Post</Btn>}
          </div>
          {noticesError && (
            <Alert kind="err" icon={Icons.AlertTri}>
              {noticesError.message}{" "}
              <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetchNotices}>Retry</button>
            </Alert>
          )}
          {noticesLoading ? <SkeletonList rows={3} /> : (
            <>
              {/* The server already returns pinned first; sorting again here
                  keeps the demo board in the same order. */}
              {[...notices].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((n) => (
                <NoticeCard key={n.id} n={n} onOpen={() => { markRead(n); setOpen(n); }} />
              ))}
              {!notices.length && (
                <Empty icon={Icons.Board} title="Notice board is empty"
                  note={can("notice.write") ? "Post the first one — every resident will see it." : "Notices from the committee appear here."} />
              )}
            </>
          )}
        </>
      )}

      {tab === "polls" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <p className="muted">{polls.length} polls</p>
            {can("poll.write") && <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("post")}>New poll</Btn>}
          </div>
          {pollsError && (
            <Alert kind="err" icon={Icons.AlertTri}>
              {pollsError.message}{" "}
              <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetchPolls}>Retry</button>
            </Alert>
          )}
          {pollsLoading ? <SkeletonList rows={2} /> : (
            <>
              {polls.map((p) => (
                <PollCard key={p.id} p={p} onVote={(o) => vote(p, o)}
                  onClose={can("poll.write") ? closePoll : null} />
              ))}
              {!polls.length && (
                <Empty icon={Icons.Poll} title="No polls running"
                  note={can("poll.write") ? "Ask the society a question — everyone gets one vote." : "Polls from the committee appear here."} />
              )}
            </>
          )}
        </>
      )}

      {tab === "forum" && (
        <Forum repo={forum} kinds={["discussion", "recommendation"]}
          canModerate={can("community.moderate")} onNew={() => setSheet("post-forum")} />
      )}
      {tab === "market" && (
        <Forum repo={forum} kinds={["classified"]} market
          canModerate={can("community.moderate")} onNew={() => setSheet("post-market")} />
      )}

      {sheet === "post" && (
        <PostNoticeSheet onPost={postNotice} onPoll={createPoll}
          tab={tab === "polls" ? "poll" : "notice"} onClose={() => setSheet(null)} />
      )}
      {(sheet === "post-forum" || sheet === "post-market") && (
        <NewPostSheet market={sheet === "post-market"} onPost={createPost} onClose={() => setSheet(null)} />
      )}
      {openNotice && (
        <NoticeSheet n={openNotice} onReact={react} onComment={comment} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function PollCard({ p, onVote, onClose }) {
  /* `resultsHidden` comes from the server, which withholds the tallies until
     this person has voted — so there is nothing here to reveal by reading the
     network tab, and the card renders what it was actually given. */
  const show = !p.resultsHidden;
  const total = p.total || 0;
  const voted = p.myVote;

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 9 }}>
        <Badge color={p.closed ? "" : "green"}>{p.closed ? "Closed" : "Open"}</Badge>
        <span className="tiny">
          {show ? `${total} vote${total === 1 ? "" : "s"}` : "Results after you vote"}
          {" · "}{p.closed ? "closed" : "closes"} {fmtDate(p.closesAt)}
        </span>
      </div>
      <p className="h3" style={{ marginBottom: 12 }}>{p.question}</p>
      {p.options.map((o) => {
        const mine = voted === o.id;
        return (
          <div key={o.id} style={{ marginBottom: 10 }}>
            <button className="dashed" disabled={!!voted || p.closed} onClick={() => onVote(o.id)}
              style={{ textAlign: "left", borderStyle: voted || p.closed ? "solid" : "dashed", borderColor: mine ? "var(--accent)" : "var(--line)", background: mine ? "var(--accent-soft)" : "none", color: "var(--ink)", marginBottom: 5 }}>
              <span className="row" style={{ width: "100%" }}>
                <span style={{ fontWeight: mine ? 700 : 600 }}>{mine && "✓ "}{o.text}</span>
                {show && <span className="tiny" style={{ fontWeight: 700 }}>{pct(o.votes, total || 1)}%</span>}
              </span>
            </button>
            {show && <Bar value={o.votes} max={total || 1} color={mine ? "var(--accent)" : "var(--line)"} />}
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 4 }}>
        {!voted && !p.closed
          ? <p className="hint">One vote per registered resident. Results are visible after you vote.</p>
          : <p className="hint">{p.createdBy ? `Asked by ${p.createdBy}` : ""}</p>}
        {onClose && !p.closed && (
          <button className="linkbtn" onClick={() => onClose(p)}>Close poll</button>
        )}
      </div>
    </div>
  );
}

function NoticeSheet({ n, onReact, onComment, onClose }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await onComment(n, text.trim());
    setSending(false);
    if (res?.ok !== false) setText("");
  };

  return (
    <Sheet title={n.title} onClose={onClose}>
      <div className="wrap" style={{ marginBottom: 10 }}>
        <Badge color={n.priority === "high" ? "red" : "blue"}>{n.kind}</Badge>
        <Badge>{n.author}</Badge>
        <Badge>{fmtDate(n.at)}</Badge>
        <Badge color="green">Read by {n.readCount ?? 0}</Badge>
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{n.body}</p>
      <div className="wrap" style={{ marginBottom: 16 }}>
        {/* `mine` comes from the server, so the chip shows what this person
            reacted rather than what this browser remembers. */}
        {["👍", "❤️", "🎉", "😟"].map((e) => {
          const mine = (n.myReactions || []).includes(e);
          return (
            <button key={e} className={`chip${mine ? " on" : ""}`} onClick={() => onReact(n, e)}>
              {e} {n.reactions?.[e] || ""}
            </button>
          );
        })}
      </div>
      <p className="h4" style={{ marginBottom: 8 }}>Comments ({n.comments?.length || 0})</p>
      {(n.comments || []).map((c) => (
        <div key={c.id} className="li" style={{ padding: "9px 0" }}>
          <Avatar name={c.author} />
          <div className="grow">
            <p className="h4">{c.author} <span className="tiny">· {ago(c.at)}</span></p>
            <p className="muted">{c.body}</p>
          </div>
        </div>
      ))}
      {!n.comments?.length && <p className="hint">No comments yet.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input className="inp" placeholder="Write a comment…" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn icon={Icons.Send} disabled={sending || !text.trim()} onClick={send} />
      </div>
    </Sheet>
  );
}

function Forum({ repo, kinds, onNew, market, canModerate }) {
  const { posts: all, loading, error, refetch, like, reply, remove } = repo;
  const posts = useMemo(() => all.filter((p) => kinds.includes(p.type)), [all, kinds]);
  const [openId, setOpenId] = useState(null);

  /* Rendered from the board rather than the row that opened it, so a reply or a
     like shows up without closing and reopening the sheet. */
  const open = openId ? posts.find((p) => p.id === openId) : null;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <p className="muted">{posts.length} {market ? "listings" : "posts"}</p>
        <Btn size="sm" icon={Icons.Plus} onClick={onNew}>{market ? "List an item" : "New post"}</Btn>
      </div>
      {error && (
        <Alert kind="err" icon={Icons.AlertTri}>
          {error.message}{" "}
          <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }} onClick={refetch}>Retry</button>
        </Alert>
      )}
      {loading ? <SkeletonList rows={3} /> : (
        <>
          {posts.map((p) => (
            <div key={p.id} className="card tap" onClick={() => setOpenId(p.id)}>
              <div className="row" style={{ marginBottom: 7 }}>
                <div className="wrap">
                  <Badge color={p.type === "classified" ? "purple" : p.type === "recommendation" ? "blue" : ""}>{p.type}</Badge>
                  {p.price != null && <Badge color="green">{p.price ? inr(p.price) : "Free"}</Badge>}
                </div>
                <span className="tiny">{ago(p.at)}</span>
              </div>
              <p className="h3" style={{ marginBottom: 4 }}>{p.title}</p>
              <p className="muted">{p.body}</p>
              <div className="row" style={{ marginTop: 9 }}>
                <span className="tiny">{p.author} · {p.authorFlat || ""}</span>
                <div className="wrap">
                  {/* `liked` comes from the server, so the heart shows whether
                      this person liked it — not whether this browser did. */}
                  <button className={`chip${p.liked ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); like(p); }}>
                    <Icons.Heart size={11} /> {p.likes}
                  </button>
                  <span className="badge bare"><Icons.Chat size={11} /> {p.comments.length}</span>
                </div>
              </div>
            </div>
          ))}
          {!posts.length && (
            <Empty icon={Icons.Chat} title={market ? "Nothing listed yet" : "No discussions yet"}
              note="Start one — it is visible only to verified residents." />
          )}
        </>
      )}

      {open && (
        <PostSheet p={open} onReply={reply} canModerate={canModerate}
          onRemove={async (post) => { const res = await remove(post); if (res.ok) setOpenId(null); }}
          onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function PostSheet({ p, onReply, onRemove, canModerate, onClose }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await onReply(p, text.trim());
    setSending(false);
    if (res?.ok !== false) setText("");
  };

  return (
    <Sheet title={p.title} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{p.body}</p>
      {p.price != null && <p className="h2" style={{ margin: "12px 0" }}>{p.price ? inr(p.price) : "Free"}</p>}
      <p className="tiny" style={{ margin: "10px 0 16px" }}>
        Posted by {p.author}{p.authorFlat ? ` · ${p.authorFlat}` : ""} · {ago(p.at)}
      </p>
      {/* Offering to dial a number nobody gave us is the leak the directory
          already fixed. When it is withheld, the reply thread is the channel —
          and saying so is more use than a button that dials four bullets. */}
      {p.contactHidden ? (
        <p className="hint" style={{ marginBottom: 16 }}>
          This resident has not shared their number. Reply below and they will see it.
        </p>
      ) : (
        <a className="btn ghost block" href={`tel:${p.authorPhone}`} style={{ textDecoration: "none", marginBottom: 16 }}>
          <Icons.Phone size={15} /> Contact resident
        </a>
      )}
      <p className="h4" style={{ marginBottom: 8 }}>Replies ({p.comments.length})</p>
      {p.comments.map((c) => (
        <div key={c.id} className="li" style={{ padding: "9px 0" }}>
          <Avatar name={c.author} />
          <div className="grow">
            <p className="h4">{c.author} <span className="tiny">· {ago(c.at)}</span></p>
            <p className="muted">{c.text}</p>
          </div>
        </div>
      ))}
      {!p.comments.length && <p className="hint">No replies yet.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input className="inp" placeholder="Reply…" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn icon={Icons.Send} disabled={sending || !text.trim()} onClick={send} />
      </div>
      {/* Your own listing is yours to take down once the item is sold; the
          committee can take down anyone's, which is what moderation is. */}
      {(p.mine || canModerate) && (
        <button className="linkbtn" style={{ marginTop: 14, color: "var(--red)" }} onClick={() => onRemove(p)}>
          {p.mine ? "Remove my post" : "Remove this post"}
        </button>
      )}
    </Sheet>
  );
}

function NewPostSheet({ market, onPost, onClose }) {
  const [f, setF] = useState({ type: market ? "classified" : "discussion", title: "", body: "", price: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet title={market ? "List an item" : "New community post"} onClose={onClose}>
      <Select label="Type" value={f.type} onChange={(e) => u("type", e.target.value)}
        options={[{ value: "discussion", label: "Discussion" }, { value: "recommendation", label: "Ask for a recommendation" }, { value: "classified", label: "Sell or give away" }]} />
      <Input label="Title" value={f.title} onChange={(e) => { u("title", e.target.value); setErr(""); }} placeholder="Short headline" />
      <TextArea label="Details" value={f.body} onChange={(e) => u("body", e.target.value)} />
      {f.type === "classified" && <Input label="Price (₹, 0 for free)" type="number" value={f.price} onChange={(e) => u("price", e.target.value)} />}
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Send} disabled={busy} onClick={async () => {
        if (!f.title.trim()) return setErr("Add a title");
        setBusy(true);
        const res = await onPost({
          type: f.type, title: f.title.trim(), body: f.body.trim(),
          /* Only a classified carries one, and the API refuses a price on
             anything else rather than dropping it silently. */
          ...(f.type === "classified" ? { price: Number(f.price || 0) } : {}),
        });
        setBusy(false);
        if (res?.ok === false) return setErr(res.error?.message || "Could not post that");
        onClose();
      }}>{busy ? "Posting…" : "Post"}</Btn>
    </Sheet>
  );
}
