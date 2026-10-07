import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { requestOrigin } from "../lib/server/config.ts";
import { sameOriginWrite } from "../lib/server/workspaces.ts";

test("local browser Host controls the origin when Next uses a listener alias", () => {
  const old = { node: process.env.NODE_ENV, url: process.env.BETTER_AUTH_URL };
  process.env.NODE_ENV = "test"; delete process.env.BETTER_AUTH_URL;
  try {
    const request = (host, origin, forwarded = "") => new Request("http://localhost:3267/api/auth/sign-in/email", {
      method: "POST", headers: { host, origin, "x-forwarded-host": forwarded },
    });
    for (const host of ["127.0.0.1:3267", "localhost:3267", "[::1]:3267"]) {
      const incoming = request(host, `http://${host}`, "evil.example");
      assert.equal(requestOrigin(incoming), `http://${host}`);
      assert.doesNotThrow(() => sameOriginWrite(incoming));
    }
    assert.throws(() => sameOriginWrite(request("127.0.0.1:3267", "http://localhost:3267")), error => error.status === 403);
    for (const host of ["evil.example:3267", "localhost:3267@evil.example", "localhost:3267/path", "localhost:3267?query", "localhost:3267#fragment", "user@localhost:3267"]) {
      assert.throws(() => requestOrigin(request(host, "http://localhost:3267")), error => error.status === 403);
    }
  } finally {
    for (const [key, value] of [["NODE_ENV", old.node], ["BETTER_AUTH_URL", old.url]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("configured production origin stays strict and rejects forwarded-host spoofing", () => {
  const old = { node: process.env.NODE_ENV, url: process.env.BETTER_AUTH_URL };
  process.env.NODE_ENV = "production"; process.env.BETTER_AUTH_URL = "https://invoice.example.test";
  try {
    const request = host => new Request("http://localhost:3000/api/auth/sign-in/email", { headers: { host, "x-forwarded-host": "invoice.example.test" } });
    assert.equal(requestOrigin(request("invoice.example.test")), "https://invoice.example.test");
    for (const host of ["evil.example", "127.0.0.1:3000"]) assert.throws(() => requestOrigin(request(host)), error => error.status === 403);
  } finally {
    for (const [key, value] of [["NODE_ENV", old.node], ["BETTER_AUTH_URL", old.url]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("signup persists across processes; login never registers an unknown account", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "invoiceflow-login-persistence-"));
  const worker = `
    import assert from "node:assert/strict";
    import { POST } from "./app/api/auth/[...all]/route.ts";
    import { database } from "./lib/server/database.ts";
    import { getAuth } from "./lib/server/auth.ts";
    const origin = "http://127.0.0.1:3267";
    const fixture = { firstName: "Persistent", lastName: "Tester", email: "persistent@example.test", password: "Synthetic persistence test passphrase 2026!" };
    const send = (endpoint, body, cookie = "") => POST(new Request("http://localhost:3267/api/auth/" + endpoint, {
      method: "POST", headers: { host: "127.0.0.1:3267", origin, cookie, "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    const db = await database();
    try {
      const unknown = await send("sign-in/email", { email: "unregistered@example.test", password: fixture.password });
      assert.equal(unknown.status, 401);
      assert.equal((await db.query("SELECT count(*)::int AS count FROM auth_user WHERE email=$1", ["unregistered@example.test"])).rows[0].count, 0);
      let response;
      if (process.env.LOGIN_TEST_STEP === "signup") {
        response = await send("sign-up/email", fixture);
        assert.equal(response.status, 200, await response.clone().text());
        const stored = (await db.query("SELECT a.password FROM auth_account a JOIN auth_user u ON a.user_id=u.id WHERE u.email=$1", [fixture.email])).rows[0];
        assert.ok(stored.password.length > 64);
        assert.notEqual(stored.password, fixture.password);
      } else {
        assert.equal((await db.query("SELECT count(*)::int AS count FROM auth_user")).rows[0].count, 1);
        assert.equal((await send("sign-in/email", { email: fixture.email, password: "An incorrect passphrase" })).status, 401);
        response = await send("sign-in/email", { email: fixture.email, password: fixture.password });
        assert.equal(response.status, 200, await response.clone().text());
      }
      const value = await response.json();
      assert.equal(value.authenticated, true);
      assert.equal("token" in value, false);
      const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      assert.ok(cookie.includes("session_token"));
      const auth = await getAuth(origin);
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      assert.equal(session.user.email, fixture.email);
      assert.equal((await db.query("SELECT count(*)::int AS count FROM auth_user")).rows[0].count, 1);
      assert.equal((await send("sign-out", {}, cookie)).status, 200);
      assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null);
    } finally { await db.close(); }
  `;
  try {
    for (const step of ["signup", "login"]) {
      const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-"], {
        cwd: path.resolve(import.meta.dirname, ".."), input: worker, encoding: "utf8", timeout: 60000,
        env: { ...process.env, NODE_ENV: "test", INVOICEFLOW_DATA_DIR: directory, INVOICEFLOW_DATABASE: "", BETTER_AUTH_URL: "", BETTER_AUTH_SECRET: "", RESEND_API_KEY: "", INVOICEFLOW_EMAIL_FROM: "", LOGIN_TEST_STEP: step },
      });
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("invoiceflow-login-persistence-"));
    await rm(directory, { recursive: true, force: true });
  }
});
