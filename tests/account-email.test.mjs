import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getAuth } from "../lib/server/auth.ts";
import { database } from "../lib/server/database.ts";
import { POST as authPost, GET as authGet } from "../app/api/auth/[...all]/route.ts";

test("configured email verification and one-time password reset revoke sessions without sending real emails", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "invoiceflow-email-test-"));
  const names = ["INVOICEFLOW_DATA_DIR", "NODE_ENV", "RESEND_API_KEY", "INVOICEFLOW_EMAIL_FROM"], old = names.map(name => process.env[name]), originalFetch = globalThis.fetch;
  let db; const links = [];
  process.env.INVOICEFLOW_DATA_DIR = directory; process.env.NODE_ENV = "test"; process.env.RESEND_API_KEY = "synthetic-test-key"; process.env.INVOICEFLOW_EMAIL_FROM = "testing@example.test";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    const message = JSON.parse(options.body); links.push(message.text.match(/https?:\/\/\S+/)[0]);
    return Response.json({ id: "mock-email-only" });
  };
  const origin = "http://localhost:3221";
  try {
    const auth = await getAuth(origin); db = await database();
    const send = (endpoint, body, cookie = "") => authPost(new Request(`${origin}/api/auth/${endpoint}`, { method: "POST", headers: { origin, cookie, "content-type": "application/json" }, body: JSON.stringify(body) }));
    const email = "email-fixture@example.test", password = "Disposable email test passphrase 2026!";
    const signup = await send("sign-up/email", { name: "Email Tester", firstName: "Email", lastName: "Tester", email, password, callbackURL: "/sign-in" });
    assert.equal(signup.status, 200); assert.equal((await signup.json()).authenticated, false); assert.equal(links.length, 1);
    assert.equal((await send("sign-in/email", { email, password })).status, 403);
    const verified = await authGet(new Request(links[0])); assert.ok([200, 302].includes(verified.status));
    const signed = await send("sign-in/email", { email, password }); assert.equal(signed.status, 200);
    const cookie = signed.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }) }));
    assert.equal((await send("request-password-reset", { email, redirectTo: "/reset-password" })).status, 200);
    const resetLink = links.at(-1), redirected = await authGet(new Request(resetLink)); assert.equal(redirected.status, 302);
    const token = new URL(redirected.headers.get("location"), origin).searchParams.get("token"); assert.ok(token);
    const newPassword = "Another disposable passphrase for reset 2026!";
    assert.equal((await send("reset-password", { token, newPassword })).status, 200);
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null);
    assert.equal((await send("reset-password", { token, newPassword })).ok, false);
    assert.equal((await send("sign-in/email", { email, password: newPassword })).status, 200);
    await send("request-password-reset", { email, redirectTo: "/reset-password" });
    await db.query("UPDATE auth_verification SET expires_at=now()-INTERVAL '1 hour'");
    const expired = await authGet(new Request(links.at(-1))); assert.ok(expired.headers.get("location").includes("INVALID_TOKEN"));
  } finally {
    globalThis.fetch = originalFetch; if (db) await db.close();
    names.forEach((name, index) => { if (old[index] === undefined) delete process.env[name]; else process.env[name] = old[index]; });
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true });
  }
});
