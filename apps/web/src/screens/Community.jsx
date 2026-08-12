import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Sheet, Empty, Segmented, Bar, Avatar, TextArea, Input, Select, Alert, SkeletonList } from "../components/ui";
import { NoticeCard } from "../components/entities";
import { PostNoticeSheet } from "../components/sheets";
import { useApp } from "../store";
import { useNotices } from "../data/notices";
import { usePolls } from "../data/polls";
import { ago, fmtDate, inr, pct, uid, iso } from "../lib/format";

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

      {tab === "forum" && <Forum kinds={["discussion", "recommendation"]} onNew={() => setSheet("post-forum")} />}
      {tab === "market" && <Forum kinds={["classified"]} onNew={() => setSheet("post-forum")} market />}

      {sheet === "post" && (
        <PostNoticeSheet onPost={postNotice} onPoll={createPoll}
          tab={tab === "polls" ? "poll" : "notice"} onClose={() => setSheet(null)} />
      )}
      {sheet === "post-forum" && <NewPostSheet onClose={() => setSheet(null)} />}
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

function Forum({ kinds, onNew, market }) {
  const { db, sel, me, patch, say } = useApp();
  const posts = useMemo(() => db.forum.filter((p) => kinds.includes(p.type)), [db.forum, kinds]);
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("");

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <p className="muted">{posts.length} {market ? "listings" : "posts"}</p>
        <Btn size="sm" icon={Icons.Plus} onClick={onNew}>{market ? "List an item" : "New post"}</Btn>
      </div>
      {posts.map((p) => (
        <div key={p.id} className="card tap" onClick={() => setOpen(p)}>
          <div className="row" style={{ marginBottom: 7 }}>
            <div className="wrap">
              <Badge color={p.type === "classified" ? "purple" : p.type === "recommendation" ? "blue" : ""}>{p.type}</Badge>
              {p.price !== undefined && <Badge color="green">{p.price ? inr(p.price) : "Free"}</Badge>}
            </div>
            <span className="tiny">{ago(p.at)}</span>
          </div>
          <p className="h3" style={{ marginBottom: 4 }}>{p.title}</p>
          <p className="muted">{p.body}</p>
          <div className="row" style={{ marginTop: 9 }}>
            <span className="tiny">{sel.userName(p.by)} · {sel.userById(p.by)?.flat || ""}</span>
            <div className="wrap">
              <button className="chip" onClick={(e) => { e.stopPropagation(); patch("forum", p.id, (x) => ({ likes: x.likes + 1 })); }}>
                <Icons.Heart size={11} /> {p.likes}
              </button>
              <span className="badge bare"><Icons.Chat size={11} /> {p.comments.length}</span>
            </div>
          </div>
        </div>
      ))}
      {!posts.length && <Empty icon={Icons.Chat} title={market ? "Nothing listed yet" : "No discussions yet"} note="Start one — it is visible only to verified residents." />}

      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)}>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>{open.body}</p>
          {open.price !== undefined && <p className="h2" style={{ margin: "12px 0" }}>{open.price ? inr(open.price) : "Free"}</p>}
          <p className="tiny" style={{ margin: "10px 0 16px" }}>Posted by {sel.userName(open.by)} · {sel.userById(open.by)?.flat} · {ago(open.at)}</p>
          <a className="btn ghost block" href={`tel:${sel.userById(open.by)?.phone}`} style={{ textDecoration: "none", marginBottom: 16 }}>
            <Icons.Phone size={15} /> Contact resident
          </a>
          <p className="h4" style={{ marginBottom: 8 }}>Replies ({open.comments.length})</p>
          {open.comments.map((c) => (
            <div key={c.id} className="li" style={{ padding: "9px 0" }}>
              <Avatar name={sel.userName(c.by)} />
              <div className="grow">
                <p className="h4">{sel.userName(c.by)} <span className="tiny">· {ago(c.at)}</span></p>
                <p className="muted">{c.text}</p>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input className="inp" placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} />
            <Btn icon={Icons.Send} onClick={() => {
              if (!text.trim()) return;
              patch("forum", open.id, (x) => ({ comments: [...x.comments, { id: uid("fc"), by: me.id, at: iso(), text: text.trim() }] }));
              setOpen((o) => ({ ...o, comments: [...o.comments, { id: uid("fc"), by: me.id, at: iso(), text: text.trim() }] }));
              setText("");
              say("Reply posted");
            }} />
          </div>
        </Sheet>
      )}
    </>
  );
}

function NewPostSheet({ onClose }) {
  const { add, me, say } = useApp();
  const [f, setF] = useState({ type: "discussion", title: "", body: "", price: "" });
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [err, setErr] = useState("");
  return (
    <Sheet title="New community post" onClose={onClose}>
      <Select label="Type" value={f.type} onChange={(e) => u("type", e.target.value)}
        options={[{ value: "discussion", label: "Discussion" }, { value: "recommendation", label: "Ask for a recommendation" }, { value: "classified", label: "Sell or give away" }]} />
      <Input label="Title" value={f.title} onChange={(e) => { u("title", e.target.value); setErr(""); }} placeholder="Short headline" />
      <TextArea label="Details" value={f.body} onChange={(e) => u("body", e.target.value)} />
      {f.type === "classified" && <Input label="Price (₹, 0 for free)" type="number" value={f.price} onChange={(e) => u("price", e.target.value)} />}
      {err && <p className="err" style={{ marginBottom: 10 }}>{err}</p>}
      <Btn block icon={Icons.Send} onClick={() => {
        if (!f.title.trim()) return setErr("Add a title");
        add("forum", {
          type: f.type, title: f.title.trim(), body: f.body.trim(), by: me.id, at: iso(), likes: 0, comments: [],
          ...(f.type === "classified" ? { price: Number(f.price || 0) } : {}),
        });
        say("Posted to the community ✓");
        onClose();
      }}>Post</Btn>
    </Sheet>
  );
}
