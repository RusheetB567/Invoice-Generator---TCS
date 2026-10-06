import { currentIdentity, findWorkspace } from "../../../../lib/server/workspaces";
import { database } from "../../../../lib/server/database";
import { privilegedMfaRequired } from "../../../../lib/server/assurance";
import { safeError } from "../../../../lib/server/vault";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const identity = await currentIdentity(request), workspace = await findWorkspace(identity.user.id), db = await database();
    const proof = (await db.query<{ method: string; recent: boolean }>("SELECT method,(verified_at BETWEEN now()-interval '10 minutes' AND now()) AS recent FROM auth_assurance WHERE session_id=$1 AND user_id=$2", [identity.session.id, identity.user.id])).rows[0];
    const sessions = (await db.query<{ id: string; created_at: Date; expires_at: Date }>("SELECT id,created_at,expires_at FROM auth_session WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC", [identity.user.id])).rows;
    return Response.json({ mfaEnabled: Boolean(identity.user.twoFactorEnabled), mfaRequired: privilegedMfaRequired(workspace?.role), recentlyVerified: proof?.method === "totp" && proof.recent, sessions: sessions.map(row => ({ ...row, current: row.id === identity.session.id })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}
