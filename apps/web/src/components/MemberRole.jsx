import { useState } from "react";
import { ROLES, CAPS } from "@gvs/shared";
import Icons from "../icons";
import { Badge, Btn, Sheet, Avatar, Input, Alert } from "./ui";

/** What each role can actually do, in the words a secretary would use. */
export const ROLE_NOTE = {
  admin: "Everything, including society settings and the flat register.",
  committee: "Notices, billing, approving residents, helpdesk, documents, reports.",
  staff: "Helpdesk, preparing billing runs, documents — never approving them.",
  guard: "The gate: admitting visitors, incidents and patrol rounds.",
  resident: "Their own flat only — its visitors, its bills, its tickets.",
};

const ROLE_TONE = { admin: "red", committee: "brand", staff: "blue", guard: "amber", resident: "" };

export const RoleBadge = ({ role }) => <Badge color={ROLE_TONE[role] ?? ""}>{role}</Badge>;

/**
 * Change one member's role.
 *
 * Every option is listed, including the ones this person may not grant — with
 * the reason shown against them. Hiding them would leave a committee member
 * wondering why "committee" is missing, when the answer is simply that only an
 * administrator may grant it.
 */
export function MemberRoleSheet({ member, refusalFor, onSave, onClose }) {
  const [role, setRole] = useState(member.role);
  const [designation, setDesignation] = useState(member.designation || "");
  const [busy, setBusy] = useState(false);

  const refusal = refusalFor(member, role);
  const changed = role !== member.role || (designation || "") !== (member.designation || "");
  const privileged = role === "admin" || role === "committee";

  const save = async () => {
    setBusy(true);
    const res = await onSave(role, designation.trim() || null);
    setBusy(false);
    if (res?.ok) onClose();
  };

  return (
    <Sheet title={member.name} onClose={onClose}>
      <div className="center" style={{ marginBottom: 14 }}>
        <Avatar name={member.name} size="lg" />
        <p className="h3" style={{ marginTop: 10 }}>{member.name}</p>
        <p className="tiny">{[member.flat && `Flat ${member.flat}`, member.email].filter(Boolean).join(" · ")}</p>
      </div>

      <p className="h4" style={{ margin: "4px 0 8px" }}>Role</p>
      <div className="list">
        {ROLES.map((r) => {
          const why = refusalFor(member, r);
          const count = CAPS[r]?.includes("*") ? "every permission" : `${CAPS[r]?.length || 0} permissions`;
          return (
            <div key={r} className={`li ${why ? "" : "tap"}${r === role ? " on" : ""}`}
              style={why ? { opacity: 0.55 } : undefined}
              onClick={() => !why && setRole(r)}>
              <div className="grow">
                <p className="h4" style={{ textTransform: "capitalize" }}>{r}{r === member.role ? " · current" : ""}</p>
                <p className="tiny" style={{ marginTop: 3 }}>{ROLE_NOTE[r]}</p>
                <p className="tiny" style={{ marginTop: 3 }}>{count}</p>
                {why && <p className="tiny" style={{ marginTop: 3, color: "var(--bad)" }}>{why}</p>}
              </div>
              {r === role && !why && <Icons.CheckCircle size={18} style={{ color: "var(--accent)" }} />}
            </div>
          );
        })}
      </div>

      {privileged && (
        <div style={{ marginTop: 12 }}>
          <Input label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)}
            hint="Shown beside their name in the directory. A label only — it grants nothing on its own."
            placeholder="e.g. Treasurer" />
        </div>
      )}

      {role === "committee" && (
        <Alert kind="info" icon={Icons.Info}>
          A billing run still needs two people: whoever prepares it cannot approve it.
        </Alert>
      )}

      {refusal ? (
        <Alert kind="err" icon={Icons.AlertTri}>{refusal}</Alert>
      ) : (
        <Btn block style={{ marginTop: 12 }} disabled={!changed || busy} onClick={save}>
          {busy ? "Saving…" : changed ? `Make ${member.name.split(" ")[0]} ${role}` : "No change"}
        </Btn>
      )}
    </Sheet>
  );
}
