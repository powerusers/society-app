import { useMemo, useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Sheet, Empty, Segmented, Bar, Avatar, TextArea, Input, Select } from "../components/ui";
import { NoticeCard } from "../components/entities";
import { PostNoticeSheet } from "../components/sheets";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { ago, fmtDate, inr, pct, uid, iso } from "../lib/format";

const TABS = [
  { value: "notices", label: "Notices" },
  { value: "polls", label: "Polls" },
  { value: "forum", label: "Discuss" },
  { value: "market", label: "Market" },
];

export default function Community({ nav }) {
  const { db, me, can, sel, add, say, patch } = useApp();
  const A = useActions();
  const [tab, setTab] = useState("notices");
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(null);

  const unread = db.notices.filter((n) => !(n.readBy || []).includes(me.id)).length;

  return (
    <>
      <Segmented value={tab} onChange={setTab} options={TABS} />

      {tab === "notices" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <p className="muted">{db.notices.length} notices · {unread} unread</p>
            {can("notice.write") && <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("post")}>Post</Btn>}
          </div>
          {[...db.notices].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((n) => (
            <NoticeCard key={n.id} n={n} onOpen={() => { A.markRead(n.id); setOpen(n); }} />
          ))}
          {!db.notices.length && <Empty icon={Icons.Board} title="Notice board is empty" />}
        </>
      )}

      {tab === "polls" && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <p className="muted">{db.polls.length} polls</p>
            {can("poll.write") && <Btn size="sm" icon={Icons.Plus} onClick={() => setSheet("post")}>New poll</Btn>}
          </div>
          {db.polls.map((p) => <PollCard key={p.id} p={p} onVote={(o) => A.vote(p, o)} me={me} />)}
          {!db.polls.length && <Empty icon={Icons.Poll} title="No polls running" />}
        </>
      )}

      {tab === "forum" && <Forum kinds={["discussion", "recommendation"]} onNew={() => setSheet("post-forum")} />}
      {tab === "market" && <Forum kinds={["classified"]} onNew={() => setSheet("post-forum")} market />}

      {sheet === "post" && <PostNoticeSheet onClose={() => setSheet(null)} />}
      {sheet === "post-forum" && <NewPostSheet onClose={() => setSheet(null)} />}
      {open && <NoticeSheet n={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PollCard({ p, onVote, me }) {
  const total = p.options.reduce((s, o) => s + o.votes, 0) || 1;
  const voted = p.voters?.[me.id];
  const closed = new Date(p.closesAt) < new Date();
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 9 }}>
        <Badge color={closed ? "" : "green"}>{closed ? "Closed" : "Open"}</Badge>
        <span className="tiny">{total} votes · closes {fmtDate(p.closesAt)}</span>
      </div>
      <p className="h3" style={{ marginBottom: 12 }}>{p.question}</p>
      {p.options.map((o) => {
        const share = pct(o.votes, total);
        const mine = voted === o.id;
        return (
          <div key={o.id} style={{ marginBottom: 10 }}>
            <button className="dashed" disabled={!!voted || closed} onClick={() => onVote(o.id)}
              style={{ textAlign: "left", borderStyle: voted || closed ? "solid" : "dashed", borderColor: mine ? "var(--brand)" : "var(--line2)", background: mine ? "var(--brand-soft)" : "none", color: "var(--ink)", marginBottom: 5 }}>
              <span className="row" style={{ width: "100%" }}>
                <span style={{ fontWeight: mine ? 700 : 600 }}>{mine && "✓ "}{o.text}</span>
                {(voted || closed) && <span className="tiny" style={{ fontWeight: 700 }}>{share}%</span>}
              </span>
            </button>
            {(voted || closed) && <Bar value={o.votes} max={total} color={mine ? "var(--brand)" : "var(--line2)"} />}
          </div>
        );
      })}
      {!voted && !closed && <p className="hint">One vote per registered resident. Results are visible after you vote.</p>}
    </div>
  );
}

function NoticeSheet({ n, onClose }) {
  const { sel, me, patch, say } = useApp();
  const A = useActions();
  const [text, setText] = useState("");
  return (
    <Sheet title={n.title} onClose={onClose}>
      <div className="wrap" style={{ marginBottom: 10 }}>
        <Badge color={n.priority === "high" ? "red" : "blue"}>{n.kind}</Badge>
        <Badge>{sel.userName(n.author)}</Badge>
        <Badge>{fmtDate(n.at)}</Badge>
        <Badge color="green">Read by {(n.readBy || []).length}</Badge>
      </div>
      <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{n.body}</p>
      <div className="wrap" style={{ marginBottom: 16 }}>
        {["👍", "❤️", "🎉", "😟"].map((e) => (
          <button key={e} className="chip" onClick={() => A.react(n.id, e)}>{e} {n.reactions?.[e] || ""}</button>
        ))}
      </div>
      <p className="h4" style={{ marginBottom: 8 }}>Comments ({n.comments?.length || 0})</p>
      {(n.comments || []).map((c) => (
        <div key={c.id} className="li" style={{ padding: "9px 0" }}>
          <Avatar name={sel.userName(c.by)} />
          <div className="grow">
            <p className="h4">{sel.userName(c.by)} <span className="tiny">· {ago(c.at)}</span></p>
            <p className="muted">{c.text}</p>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input className="inp" placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn icon={Icons.Send} onClick={() => {
          if (!text.trim()) return;
          patch("notices", n.id, (x) => ({ comments: [...(x.comments || []), { id: uid("c"), by: me.id, at: iso(), text: text.trim() }] }));
          setText("");
          say("Comment posted");
        }} />
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
              <span className="badge"><Icons.Chat size={11} /> {p.comments.length}</span>
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
        options={[{ value: "discussion", label: "💬 Discussion" }, { value: "recommendation", label: "🙋 Ask for a recommendation" }, { value: "classified", label: "🏷️ Sell / give away" }]} />
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
