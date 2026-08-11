/**
 * Issue, list and revoke society invite codes.
 *
 * Onboarding a society is an operator action, and this is the operator's tool
 * for it — it talks to the database directly rather than over HTTP, so it needs
 * DATABASE_URL but not a running API and not SETUP_TOKEN.
 *
 *   npm run invite --workspace @gvs/api -- new --label "Sunrise Residency" \
 *     --society "Sunrise Residency" --email secretary@sunrise.in --days 14
 *   npm run invite --workspace @gvs/api -- list
 *   npm run invite --workspace @gvs/api -- revoke <id>
 */
import { formatInviteCode } from "@gvs/shared";
import { createInvite, listInvites, revokeInvite } from "../src/lib/invites.js";
import { closePool } from "../src/db/pool.js";

const argv = process.argv.slice(2);
const cmd = argv[0] || "list";
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

try {
  if (cmd === "new") {
    const invite = await createInvite({
      label: flag("label", ""),
      societyName: flag("society", null),
      email: flag("email", null),
      days: Number(flag("days", 14)),
    });

    console.log("\n  Invite code:  " + formatInviteCode(invite.code.replace(/-/g, "")));
    console.log("  Expires:      " + fmtDate(invite.expires_at));
    if (invite.society_name) console.log("  Only creates: " + invite.society_name);
    if (invite.email) console.log("  Only usable by: " + invite.email);
    console.log("\n  Give this to the society's secretary. They enter it on the setup screen.");
    /* Said plainly because it cannot be undone: the database holds a hash, so
       there is no command that prints this code again. */
    console.log("  It is shown once — only its hash is stored. Lost codes are reissued, not recovered.\n");
  } else if (cmd === "list") {
    const rows = await listInvites();
    if (!rows.length) console.log("No invites issued yet.");
    for (const r of rows) {
      const pins = [r.society_name, r.email].filter(Boolean).join(" · ");
      const used = r.used_by_name ? ` -> ${r.used_by_name}` : "";
      console.log(
        `  ${r.status.padEnd(8)} ${String(r.label || "(no label)").padEnd(28)} ` +
        `expires ${fmtDate(r.expires_at)}  ${r.id}${used}${pins ? `  [${pins}]` : ""}`,
      );
    }
  } else if (cmd === "revoke") {
    const id = argv[1];
    if (!id) throw new Error("Usage: revoke <invite-id>   (ids come from `list`)");
    const gone = await revokeInvite(id);
    console.log(gone ? `Revoked ${id}` : `No open invite with id ${id} — already used, revoked, or unknown.`);
  } else {
    console.log("Usage: invite new|list|revoke");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[invite] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
