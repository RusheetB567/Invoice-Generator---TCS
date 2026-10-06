import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { POST as authEndpoint, GET as authGet } from "../app/api/auth/[...all]/route.ts";
import { GET as stateEndpoint, POST as preferenceEndpoint } from "../app/api/workspace/state/route.ts";
import { GET as exportEndpoint } from "../app/api/vault/export/route.ts";
import { GET as securityEndpoint } from "../app/api/account/security/route.ts";
import { createWorkspace, finishOnboarding } from "../lib/server/workspaces.ts";
import { database } from "../lib/server/database.ts";
import { getAuth } from "../lib/server/auth.ts";
import { permitted } from "../lib/server/permissions.ts";
// Independent RFC 6238 generator, used only for synthetic authenticator fixtures.
function totp(encoded, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...encoded].map(char => alphabet.indexOf(char).toString(2).padStart(5, "0")).join("");
  const secret = Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const hash = createHmac("sha1", secret).update(counter).digest(), index = hash.at(-1) & 15;
  return ((hash.readUInt32BE(index) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
test("MFA HTTP facade enforces enrollment, replay, recent proof, recovery assurance and role denial", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "invoiceflow-mfa-"));
  const old = { dir: process.env.INVOICEFLOW_DATA_DIR, node: process.env.NODE_ENV, url: process.env.BETTER_AUTH_URL };
  process.env.INVOICEFLOW_DATA_DIR = directory; process.env.NODE_ENV = "development"; delete process.env.BETTER_AUTH_URL;
  const origin = "http://localhost:3281", password = "Synthetic MFA test passphrase 2026!", jar = new Map();
  const cookie = () => [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
  const request = (url, method = "GET", body) => new Request(`${origin}${url}`, { method, headers: { origin, cookie: cookie(), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  async function send(endpoint, body = {}) {
    const response = await authEndpoint(request(`/api/auth/${endpoint}`, "POST", body));
    for (const value of response.headers.getSetCookie()) { const pair = value.split(";")[0], index = pair.indexOf("="); jar.set(pair.slice(0,index), pair.slice(index+1)); }
    return response;
  }
  const db = await database();
  try {
    assert.equal((await authGet(request("/api/auth/get-session"))).status, 404);
    assert.equal((await send("two-factor/view-backup-codes")).status, 404);
    const signup = await send("sign-up/email", { firstName: "MFA", lastName: "Tester", email: "mfa@example.test", password });
    assert.equal(signup.status, 200, await signup.clone().text());
    const value = await signup.json(); assert.equal(value.authenticated, true); assert.ok(!("token" in value));
    const userId = value.user.id, workspaceId = await createWorkspace(userId, "MFA business");
    await finishOnboarding(userId, { legalName: "MFA business", address: "", country: "Australia", businessNumber: "", currency: "AUD", industry: "Design", gstRegistered: true, accent: "#7240c4", payment: "" });
    assert.equal((await exportEndpoint(request("/api/vault/export"))).status, 403);
    assert.equal((await send("change-password", { currentPassword: password, newPassword: "Another synthetic passphrase 2026!" })).status, 403);
    const crossSite = request("/api/auth/two-factor/enable", "POST", { password }); crossSite.headers.set("origin", "https://outsider.example"); assert.equal((await authEndpoint(crossSite)).status, 403);
    assert.ok(!(await send("two-factor/enable", { password: "wrong password" })).ok);
    const enabled = await send("two-factor/enable", { password }); assert.equal(enabled.status, 200, await enabled.clone().text());
    const enrollment = await enabled.json(), secret = new URL(enrollment.totpURI).searchParams.get("secret"); assert.ok(secret); assert.equal(enrollment.backupCodes.length, 10);
    const stored = (await db.query("SELECT secret,backup_codes FROM auth_two_factor WHERE user_id=$1", [userId])).rows[0];
    assert.ok(!stored.secret.includes(secret)); assert.ok(!stored.backup_codes.includes(enrollment.backupCodes[0]));
    assert.equal((await securityEndpoint(request("/api/account/security"))).status, 200);
    assert.equal((await (await securityEndpoint(request("/api/account/security"))).json()).mfaEnabled, false);
    assert.ok(!(await send("two-factor/verify-totp", { code: totp(secret, -10) })).ok);
    const code = totp(secret), verified = await send("two-factor/verify-totp", { code }); assert.equal(verified.status, 200, await verified.clone().text());
    const status = await (await securityEndpoint(request("/api/account/security"))).json(); assert.equal(status.mfaEnabled, true); assert.equal(status.recentlyVerified, true); assert.ok(!JSON.stringify(status).includes("token"));
    assert.equal((await stateEndpoint(request("/api/workspace/state"))).status, 200);
    const preferences = { revision: 0, brand: { company: "MFA business", tagline: "", companyAddress: "", businessIdentifier: "", brand: "#7240c4", payment: "Synthetic bank instructions", logo: "" } };
    assert.equal((await preferenceEndpoint(request("/api/workspace/state", "POST", preferences))).status, 200);
    const replay = await send("two-factor/verify-totp", { code }); assert.equal(replay.status, 409); assert.equal((await replay.json()).code, "CODE_REPLAYED");
    const exported = await exportEndpoint(request("/api/vault/export")); assert.equal(exported.status, 200, await exported.clone().text());
    await db.query("UPDATE workspace_membership SET role='MEMBER' WHERE user_id=$1", [userId]);
    assert.equal((await exportEndpoint(request("/api/vault/export"))).status, 403);
    assert.equal((await preferenceEndpoint(request("/api/workspace/state", "POST", { revision: 0, reminders: { enabled: false, days: [], includeSummary: false, includePdf: false, minimumAmount: "0" } }))).status, 403);
    await db.query("UPDATE workspace_membership SET role='OWNER' WHERE user_id=$1", [userId]);
    await db.query("UPDATE auth_assurance SET verified_at=now()-interval '11 minutes' WHERE user_id=$1", [userId]);
    const expired = await exportEndpoint(request("/api/vault/export")); assert.equal(expired.status, 403); assert.equal((await expired.json()).code, "STEP_UP_REQUIRED");
    assert.equal((await preferenceEndpoint(request("/api/workspace/state", "POST", { ...preferences, revision: 1, brand: { ...preferences.brand, payment: "Changed synthetic bank instructions" } }))).status, 403);
    // Move only fixture rate-limit clocks to a new window; production limits remain enabled.
    await db.query("UPDATE auth_rate_limit SET last_request=0");
    await send("sign-out"); jar.clear();
    const login = await send("sign-in/email", { email: "mfa@example.test", password }); assert.equal((await login.json()).twoFactorRedirect, true);
    assert.equal((await stateEndpoint(request("/api/workspace/state"))).status, 401);
    const recovered = await send("two-factor/verify-backup-code", { code: enrollment.backupCodes[0] }); assert.equal(recovered.status, 200, await recovered.clone().text());
    assert.equal((await stateEndpoint(request("/api/workspace/state"))).status, 200);
    assert.equal((await exportEndpoint(request("/api/vault/export"))).status, 403);
    assert.equal((await send("two-factor/disable", { password })).status, 403);
    await send("sign-out"); jar.clear();
    await send("sign-in/email", { email: "mfa@example.test", password });
    assert.ok(!(await send("two-factor/verify-backup-code", { code: enrollment.backupCodes[0] })).ok);
    assert.equal((await stateEndpoint(request("/api/workspace/state"))).status, 401);
    const events = (await db.query("SELECT action,metadata FROM workspace_audit WHERE workspace_id=$1", [workspaceId])).rows;
    assert.ok(events.some(row => row.action === "security.mfa_enabled")); assert.ok(!JSON.stringify(events).includes(enrollment.backupCodes[0])); assert.ok(!JSON.stringify(events).includes(secret));
    assert.equal(permitted("UNKNOWN", "invoice.read"), false); assert.equal(permitted("VIEWER", "invoice.write"), false); assert.equal(permitted("MEMBER", "workspace.export"), false);
    // Delete current proof, including a real recovered session, and fail closed.
    const auth = await getAuth(origin); assert.equal(await auth.api.getSession({ headers: request("/").headers }), null);
  } finally {
    await db.close();
    for (const [key, previous] of [["INVOICEFLOW_DATA_DIR", old.dir], ["NODE_ENV", old.node], ["BETTER_AUTH_URL", old.url]]) { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true });
  }
});
