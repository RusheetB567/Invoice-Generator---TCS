import { getAuth, signingSecret } from "../../../../lib/server/auth";
import { safeError, VaultError } from "../../../../lib/server/vault";
import { boundedJson } from "../../../../lib/server/request-body";
import { requestOrigin } from "../../../../lib/server/config";
import { sameOriginWrite, findWorkspace } from "../../../../lib/server/workspaces";
import { database } from "../../../../lib/server/database";
import { recordProof, requireRecentStrong, privilegedMfaRequired, securityAudit } from "../../../../lib/server/assurance";
import { createHmac } from "node:crypto";
export const runtime = "nodejs";
const postPaths = new Set(["sign-up/email", "sign-in/email", "sign-out", "update-user", "change-password", "revoke-other-sessions", "request-password-reset", "reset-password", "send-verification-email", "two-factor/enable", "two-factor/verify-totp", "two-factor/verify-backup-code", "two-factor/disable", "two-factor/generate-backup-codes"]);
const getPaths = new Set(["verify-email"]);
function responseCookies(request: Request, response: Response) {
  const cookies = new Map((request.headers.get("cookie") || "").split(";").filter(Boolean).map(pair => { const index = pair.indexOf("="); return [pair.slice(0, index).trim(), pair.slice(index + 1)]; }));
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], index = pair.indexOf("="); cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
  const headers = new Headers(request.headers);
  headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  return headers;
}
async function accountThrottle(subject: string, action: string, maximum: number, key: string) {
  const digest = createHmac("sha256", key).update(`${action}:${subject}`).digest("hex"), now = Date.now();
  const result = await (await database()).query<{ count: number }>("INSERT INTO auth_rate_limit(id,key,count,last_request) VALUES($1,$1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate_limit.last_request < $2-60000 THEN 1 ELSE auth_rate_limit.count+1 END,last_request=CASE WHEN auth_rate_limit.last_request < $2-60000 THEN $2 ELSE auth_rate_limit.last_request END RETURNING count", [`account:${digest}`, now]);
  if (result.rows[0].count > maximum) throw new VaultError("Too many attempts. Wait a minute and try again.", 429);
}
async function handle(incomingRequest: Request) {
  try {
    const origin = requestOrigin(incomingRequest), incoming = new URL(incomingRequest.url);
    const endpoint = incoming.pathname.replace(/^\/api\/auth\//, "");
    const allowed = incomingRequest.method === "POST" ? postPaths.has(endpoint) : getPaths.has(endpoint) || /^reset-password\/[A-Za-z0-9_-]{20,200}$/.test(endpoint);
    if (!allowed) throw new VaultError("This authentication endpoint is unavailable.", 404);
    const auth = await getAuth(origin);
    const before = await auth.api.getSession({ headers: incomingRequest.headers });
    let body: Record<string, unknown> = {};
    if (incomingRequest.method === "POST") {
      sameOriginWrite(incomingRequest);
      body = await boundedJson(incomingRequest, 16000);
      const key = await signingSecret();
      if (typeof body.email === "string") await accountThrottle(body.email.trim().toLowerCase(), endpoint, endpoint === "sign-in/email" ? 10 : 5, key);
      if (before && endpoint.startsWith("two-factor/")) await accountThrottle(before.user.id, "mfa", 5, key);
      if (before && endpoint === "change-password") await accountThrottle(before.user.id, endpoint, 5, key);
      if (body.trustDevice || body.disableSession) throw new VaultError("Trusted-device bypasses and sessionless verification are disabled.", 422);
      if (endpoint === "sign-up/email" && typeof body.firstName === "string" && typeof body.lastName === "string") body.name = `${body.firstName.trim()} ${body.lastName.trim()}`;
      if (endpoint === "two-factor/enable") body.method = "totp";
      if (endpoint === "update-user" && Object.keys(body).some(key => !["firstName", "lastName", "name"].includes(key))) throw new VaultError("Only your account name can be changed here.", 422);
      if (["change-password", "two-factor/disable", "two-factor/generate-backup-codes"].includes(endpoint)) {
        if (!before) throw new VaultError("Sign in before changing account security.", 401);
        await requireRecentStrong(before);
        if (endpoint === "two-factor/disable" && privilegedMfaRequired((await findWorkspace(before.user.id))?.role)) throw new VaultError("Business administrators must keep MFA enabled in production.", 403);
      }
    }
    const headers = new Headers(incomingRequest.headers); headers.delete("content-length");
    const request = new Request(`${origin}${incoming.pathname}${incoming.search}`, { headers, method: incomingRequest.method, ...(incomingRequest.method === "POST" ? { body: JSON.stringify(body) } : {}) });
    const response = await auth.handler(request);
    if (response.ok && ["two-factor/verify-totp", "two-factor/verify-backup-code"].includes(endpoint)) {
      const after = await auth.api.getSession({ headers: responseCookies(request, response) });
      if (!after) throw new VaultError("Verification did not establish a session. Sign in again.", 401);
      try { await recordProof(after, endpoint.endsWith("verify-totp") ? "totp" : "recovery", String(body.code), await signingSecret()); }
      catch (error) {
        if (!before || after.session.id !== before.session.id) await (await database()).query("DELETE FROM auth_session WHERE id=$1 AND user_id=$2", [after.session.id, after.user.id]);
        await securityAudit(after.user.id, "security.mfa_rejected", { code: error instanceof VaultError ? error.code || "DENIED" : "DENIED" });
        throw error;
      }
      if (before && !before.user.twoFactorEnabled && after.user.twoFactorEnabled) {
        await (await database()).query("DELETE FROM auth_session WHERE user_id=$1 AND id<>$2", [after.user.id, after.session.id]);
        await securityAudit(after.user.id, "security.mfa_enabled");
      }
    }
    if (before && !response.ok && endpoint.startsWith("two-factor/verify")) await securityAudit(before.user.id, "security.mfa_failed");
    if (before && response.ok && ["change-password", "two-factor/disable", "two-factor/generate-backup-codes", "revoke-other-sessions"].includes(endpoint)) {
      await securityAudit(before.user.id, `security.${endpoint.replaceAll("/", ".")}`);
      if (endpoint === "two-factor/disable") await (await database()).query("DELETE FROM auth_session WHERE user_id=$1", [before.user.id]);
      if (endpoint === "change-password") {
        const after = await auth.api.getSession({ headers: responseCookies(request, response) });
        if (after && after.session.id !== before.session.id) await (await database()).query("DELETE FROM auth_assurance WHERE session_id=$1", [after.session.id]);
      }
    }
    const outputHeaders = new Headers(response.headers); outputHeaders.set("Cache-Control", "no-store");
    if (outputHeaders.get("content-type")?.includes("application/json")) {
      const text = await response.text();
      if (!text) return new Response(null, { status: response.status, headers: outputHeaders });
      const value = JSON.parse(text);
      if (value && typeof value === "object" && "token" in value) { value.authenticated = Boolean(value.token); delete value.token; }
      outputHeaders.delete("content-length");
      return new Response(JSON.stringify(value), { status: response.status, headers: outputHeaders });
    }
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  } catch (error) { return safeError(error); }
}
export const GET = handle;
export const POST = handle;
