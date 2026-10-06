import { createHmac } from "node:crypto";
import { database } from "./database";
import { VaultError } from "./errors";
import { audit } from "./audit";
import { production } from "./config";
type Identity = { user: { id: string; twoFactorEnabled?: boolean | null }; session: { id: string } };
export function privilegedMfaRequired(role?: string) { return production() && (role === "OWNER" || role === "ADMIN"); }
export async function securityAudit(userId: string, action: string, metadata: Record<string, string | number | boolean> = {}) {
  const db = await database();
  const memberships = await db.query<{ workspace_id: string }>("SELECT workspace_id FROM workspace_membership WHERE user_id=$1", [userId]);
  for (const row of memberships.rows) await audit(db, row.workspace_id, userId, action, undefined, metadata);
}
export async function requireMfaSession(identity: Identity, role?: string) {
  if (!identity.user.twoFactorEnabled) {
    if (privilegedMfaRequired(role)) throw new VaultError("Set up an authenticator in Account security before opening business records.", 403, "MFA_ENROLLMENT_REQUIRED");
    return;
  }
  const rows = await (await database()).query("SELECT session_id FROM auth_assurance WHERE session_id=$1 AND user_id=$2", [identity.session.id, identity.user.id]);
  if (!rows.rows.length) throw new VaultError("Verify your authenticator in Account security to continue.", 403, "MFA_REQUIRED");
}
export async function requireRecentStrong(identity: Identity) {
  const rows = await (await database()).query("SELECT session_id FROM auth_assurance WHERE session_id=$1 AND user_id=$2 AND method='totp' AND verified_at BETWEEN now()-interval '10 minutes' AND now()", [identity.session.id, identity.user.id]);
  if (!identity.user.twoFactorEnabled || !rows.rows.length) throw new VaultError("Verify your authenticator in Account security, then retry this sensitive action. Verification lasts ten minutes.", 403, "STEP_UP_REQUIRED");
}
export async function recordProof(identity: Identity, method: "totp" | "recovery", code: string, key: string) {
  await (await database()).transaction(async tx => {
    await tx.query("SELECT id FROM auth_user WHERE id=$1 FOR UPDATE", [identity.user.id]);
    if (method === "totp") {
      // Store only a keyed digest; a six-digit code must never be searchable in logs or the database.
      await tx.query("DELETE FROM auth_totp_use WHERE used_at < now()-interval '2 minutes'");
      const digest = createHmac("sha256", key).update(`${identity.user.id}:${code}`).digest("hex");
      const used = await tx.query("INSERT INTO auth_totp_use(user_id,code_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id", [identity.user.id, digest]);
      if (!used.rows.length) throw new VaultError("That authenticator code has already been used. Wait for the next code.", 409, "CODE_REPLAYED");
    }
    await tx.query("INSERT INTO auth_assurance(session_id,user_id,method) VALUES($1,$2,$3) ON CONFLICT(session_id) DO UPDATE SET method=excluded.method,verified_at=now()", [identity.session.id, identity.user.id, method]);
    const memberships = await tx.query<{ workspace_id: string }>("SELECT workspace_id FROM workspace_membership WHERE user_id=$1", [identity.user.id]);
    for (const row of memberships.rows) await audit(tx, row.workspace_id, identity.user.id, "security.mfa_verified", undefined, { method });
  });
}
