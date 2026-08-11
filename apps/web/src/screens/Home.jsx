import { useState } from "react";
import Icons from "../icons";
import { Badge, Btn, Stat, Alert, Empty , EmojiTile} from "../components/ui";
import { NoticeCard, VisitorCard, ApproveDeny, QuickAction, OverstayPill, HelpRow } from "../components/entities";
import { PreApproveSheet, RaiseTicketSheet } from "../components/sheets";
import { useApp } from "../store";
import { useActions } from "../store/actions";
import { useVisitors } from "../data/visitors";
import { useMyBills } from "../data/bills";
import { inr, lakh, cycleLabel, fmtDate, pct, thisCycle, fmtTime } from "../lib/format";

export default function Home({ nav }) {
  const { db, me, can, sel } = useApp();
  const A = useActions();
  const { visitors, transition } = useVisitors();
  const { bills, dues } = useMyBills();
  const [sheet, setSheet] = useState(null);

  const flat = me.flat;
  const dueBill = bills.find((b) => b.status !== "paid");
  const pending = visitors.filter((v) => v.status === "pending" && v.flatCode === flat);
  const inside = visitors.filter((v) => v.status === "inside" && v.flatCode === flat);
  const help = sel.helpOf(flat);
  const helpIn = help.filter((h) => h.status === "in");
  const myTickets = db.tickets.filter((t) => t.flatCode === flat && t.status !== "closed");
  const myBookings = db.bookings.filter((b) => b.userId === me.id && b.status !== "cancelled" && b.date >= new Date().toISOString().slice(0, 10));
  const openPoll = db.polls.find((p) => !p.voters?.[me.id] && new Date(p.closesAt) > new Date());

  const cycle = thisCycle();
  const billed = sel.billed(cycle);
  const collected = sel.collected(cycle);

  return (
    <>
      {/* dues / welcome */}
      <div className="panel">
        <p className="tiny">{dues ? "Outstanding" : "Nothing outstanding"}</p>
        <p className="h1" style={{ marginTop: 6 }}>{inr(dues)}</p>
        <p className="tiny" style={{ marginTop: 6 }}>
          {dueBill ? `${cycleLabel(dueBill.cycle)} · due ${fmtDate(dueBill.dueDate)}` : `Flat ${flat} is fully paid up.`}
        </p>
        {dueBill && (
          <Btn variant="white" block style={{ marginTop: 14 }} onClick={() => nav.switchTab("payments")}>
            Pay {inr(dueBill.total)}
          </Btn>
        )}
      </div>

      {/* live gate activity */}
      {pending.length > 0 && (
        <>
          <div className="alert warn">
            <span className="blink" />
            <span className="grow"><b>{pending.length} visitor{pending.length > 1 ? "s are" : " is"} waiting at the gate</b> for your approval.</span>
          </div>
          {pending.map((v) => (
            <VisitorCard key={v.id} v={v}
              actions={<ApproveDeny onApprove={() => transition(v, "approved")} onDeny={() => transition(v, "denied")} />} />
          ))}
        </>
      )}

      {inside.length > 0 && (
        <div className="list">
          {inside.map((v) => (
            <div key={v.id} className="li">
              <div className="ico-tile"><Icons.Box size={18} /></div>
              <div className="grow">
                <p className="h4">{v.name} is inside</p>
                <p className="tiny" style={{ marginTop: 2 }}>Entered at {fmtTime(v.entryAt)} · {v.purpose || v.category}</p>
              </div>
              <OverstayPill v={v} defaultMins={db.settings.overstayMins} />
            </div>
          ))}
        </div>
      )}

      {/* quick actions */}
      <div className="sect"><h2 className="h2">Quick actions</h2></div>
      <div className="grid2">
        <QuickAction icon={Icons.UserPlus} label={"Pre-approve\nvisitor"} onClick={() => setSheet("pre")} />
        <QuickAction icon={Icons.Ticket} label={"Raise a\ncomplaint"} onClick={() => setSheet("ticket")} />
        <QuickAction icon={Icons.Calendar} label={"Book an\namenity"} onClick={() => nav.go("amenities")} />
        <QuickAction icon={Icons.Users} label={"Daily help\n& staff"} onClick={() => nav.go("dailyHelp")} />
        <QuickAction icon={Icons.Car} label={"Vehicles &\nparking"} onClick={() => nav.go("vehicles")} />
        <QuickAction icon={Icons.Phone} label={"Emergency\ncontacts"} onClick={() => nav.go("emergency")} tone="red" />
      </div>

      {/* committee snapshot */}
      {can("accounts.view") && (
        <>
          <div className="sect">
            <h2 className="h2">Society snapshot</h2>
            <button className="linkbtn" onClick={() => nav.switchTab("dashboard")}>Open dashboard →</button>
          </div>
          <div className="grid3">
            <Stat value={`${pct(collected, billed)}%`} label="Collected" color="var(--green)" />
            <Stat value={db.tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length} label="Open tickets" color="var(--amber)" />
            <Stat value={db.registrations.filter((r) => r.status === "pending").length} label="Approvals" color="var(--blue)" />
          </div>
          <div className="card">
            <div className="row">
              <div>
                <p className="tiny">Collections this cycle</p>
                <p className="h3">{lakh(collected)} <span className="tiny">of {lakh(billed)}</span></p>
              </div>
              <Badge color={pct(collected, billed) > 70 ? "green" : "amber"}>{cycleLabel(cycle)}</Badge>
            </div>
            <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pct(collected, billed)}%` }} /></div>
          </div>
        </>
      )}

      {/* poll */}
      {openPoll && (
        <>
          <div className="sect"><h2 className="h2">Your vote is pending</h2></div>
          <div className="card">
            <p className="h3" style={{ marginBottom: 10 }}>{openPoll.question}</p>
            {openPoll.options.map((o) => (
              <button key={o.id} className="dashed" style={{ marginBottom: 7, textAlign: "left" }} onClick={() => A.vote(openPoll, o.id)}>
                {o.text}
              </button>
            ))}
            <p className="tiny">Closes {fmtDate(openPoll.closesAt)} · {openPoll.options.reduce((s, o) => s + o.votes, 0)} votes so far</p>
          </div>
        </>
      )}

      {/* daily help */}
      {help.length > 0 && (
        <>
          <div className="sect">
            <h2 className="h2">Your daily help</h2>
            <button className="linkbtn" onClick={() => nav.go("dailyHelp")}>{helpIn.length} inside →</button>
          </div>
          <div className="list">{help.slice(0, 3).map((h) => <HelpRow key={h.id} h={h} />)}</div>
        </>
      )}

      {/* tickets */}
      {myTickets.length > 0 && (
        <>
          <div className="sect">
            <h2 className="h2">Your open complaints</h2>
            <button className="linkbtn" onClick={() => nav.go("helpdesk")}>All →</button>
          </div>
          <div className="list">
            {myTickets.slice(0, 2).map((t) => (
              <div key={t.id} className="li tap" onClick={() => nav.go("helpdesk", { ticketId: t.id })}>
                <div className="ico-tile"><Icons.Ticket size={18} /></div>
                <div className="grow">
                  <p className="h4 truncate">{t.title}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{t.ref} · {t.category}</p>
                </div>
                <Badge color={t.status === "open" ? "amber" : "blue"}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {/* bookings */}
      {myBookings.length > 0 && (
        <>
          <div className="sect">
            <h2 className="h2">Upcoming bookings</h2>
            <button className="linkbtn" onClick={() => nav.go("amenities")}>Book →</button>
          </div>
          <div className="list">
            {myBookings.map((b) => (
              <div key={b.id} className="li">
                <EmojiTile>{sel.amenity(b.amenityId)?.emoji}</EmojiTile>
                <div className="grow">
                  <p className="h4">{sel.amenity(b.amenityId)?.name}</p>
                  <p className="tiny" style={{ marginTop: 2 }}>{fmtDate(b.date)} · {b.slot}</p>
                </div>
                <Badge color={b.status === "confirmed" ? "green" : "amber"}>{b.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {/* notices */}
      <div className="sect">
        <h2 className="h2">Notice board</h2>
        <button className="linkbtn" onClick={() => nav.switchTab("community")}>View all →</button>
      </div>
      {db.notices.slice(0, 2).map((n) => (
        <NoticeCard key={n.id} n={n} onOpen={() => nav.switchTab("community")} />
      ))}
      {db.notices.length === 0 && <Empty icon={Icons.Board} title="No notices yet" />}

      {sheet === "pre" && <PreApproveSheet onClose={() => setSheet(null)} />}
      {sheet === "ticket" && <RaiseTicketSheet onClose={() => setSheet(null)} />}
    </>
  );
}
