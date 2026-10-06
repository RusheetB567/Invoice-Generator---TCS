import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { getAuth } from "../lib/server/auth.ts";
import { database } from "../lib/server/database.ts";
import { createWorkspace, finishOnboarding } from "../lib/server/workspaces.ts";
import { POST as saveEndpoint } from "../app/api/invoices/route.ts";
import { GET as readEndpoint, DELETE as archiveEndpoint } from "../app/api/invoices/[id]/route.ts";
import { GET as stateEndpoint, POST as preferencesEndpoint } from "../app/api/workspace/state/route.ts";
import { GET as pdfEndpoint } from "../app/api/invoices/[id]/pdf/route.ts";
import { GET as privacyExport, POST as privacyRequest } from "../app/api/workspace/privacy/route.ts";
import { validateInvoice, invoiceSummary } from "../lib/server/invoices.ts";
import { renderInvoicePdf } from "../lib/server/invoice-pdf.ts";
import { storeOriginal, readOriginal } from "../lib/server/object-storage.ts";
import { encryptedLocalBackup, restoreLocalBackup } from "../lib/server/local-backup.ts";
import { applicationOrigin, assertProductionConfigured, postgresOptions } from "../lib/server/config.ts";
import { boundedMultipart } from "../lib/server/request-body.ts";
import { PDFParse } from "pdf-parse";

const origin = "http://localhost:3201";
function invoice(overrides = {}) {
  const form = { company: "North Studio", tagline: "Thoughtful design", companyAddress: "Adelaide, Australia", customer: "Sample Client", customerAddress: "Brisbane", location: "", number: "", issued: "2026-10-01", due: "2026-10-15", brand: "#7240c4", lineLabel: "Hours", taxLabel: "GST", tax: "10", notes: "Thank you for your business.", payment: "", businessIdentifier: "Sample business ID" };
  return { id: randomUUID(), revision: 0, number: "", company: form.company, customer: form.customer, currency: "AUD", status: "Draft", issued: form.issued, due: form.due, updatedAt: new Date().toISOString(), subtotalCents: "30000", taxCents: "3000", totalCents: "33000", form, items: [], format: "sections", sections: [{ id: 1, heading: "Design consultation", details: "Project planning and design review.", amount: "300" }], logo: "", ...overrides };
}
async function setup(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "invoiceflow-backend-test-"));
  const old = { directory: process.env.INVOICEFLOW_DATA_DIR, node: process.env.NODE_ENV };
  process.env.INVOICEFLOW_DATA_DIR = directory; process.env.NODE_ENV = "test";
  const db = await database();
  try {
    const auth = await getAuth(origin);
    const signup = async email => {
      const result = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ name: "Test Owner", firstName: "Test", lastName: "Owner", email, password: "Disposable passphrase for testing 2026!" }) }));
      assert.equal(result.status, 200, await result.clone().text());
      const value = await result.json(), cookie = result.headers.getSetCookie().map(item => item.split(";")[0]).join("; ");
      const workspaceId = await createWorkspace(value.user.id, "Test business");
      await finishOnboarding(value.user.id, { legalName: "Test business", address: "Adelaide", country: "Australia", businessNumber: "", currency: "AUD", industry: "Design", gstRegistered: true, accent: "#7240c4", payment: "" });
      return { userId: value.user.id, workspaceId, cookie };
    };
    const first = await signup("first@example.test"), second = await signup("second@example.test");
    const request = (pathname, method = "GET", body, cookie = first.cookie) => new Request(`${origin}${pathname}`, { method, headers: { origin, cookie, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    await run({ db, directory, first, second, request });
  } finally {
    await db.close();
    for (const [key, value] of [["INVOICEFLOW_DATA_DIR", old.directory], ["NODE_ENV", old.node]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
}

test("server invoice saves enforce totals, scoped permissions, revisions, numbering and append-only history", async () => setup(async ({ db, first, second, request }) => {
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", invoice(), ""))).status, 401);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", invoice({ totalCents: "1" })))).status, 422);
  const initial = invoice(), result = await saveEndpoint(request("/api/invoices", "POST", initial));
  assert.equal(result.status, 200, await result.clone().text());
  const saved = (await result.json()).invoice; assert.equal(saved.number, "INV-00001"); assert.equal(saved.revision, 1);
  const context = { params: Promise.resolve({ id: saved.id }) };
  assert.equal((await readEndpoint(request(`/api/invoices/${saved.id}`, "GET", undefined, second.cookie), context)).status, 404);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", saved, second.cookie))).status, 404);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", { ...initial, number: saved.number, form: { ...initial.form, number: saved.number }, id: randomUUID() }))).status, 409);
  const update = await saveEndpoint(request("/api/invoices", "POST", { ...saved, status: "Sent" }));
  const latest = (await update.json()).invoice; assert.equal(latest.revision, 2);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", saved))).status, 409);
  const parallel = await Promise.all([saveEndpoint(request("/api/invoices", "POST", invoice())), saveEndpoint(request("/api/invoices", "POST", invoice()))]);
  const numbers = await Promise.all(parallel.map(async response => (await response.json()).invoice.number));
  assert.deepEqual(new Set(numbers), new Set(["INV-00002", "INV-00003"]));
  const crossSite = request("/api/invoices", "POST", latest); crossSite.headers.set("origin", "https://outside.example"); assert.equal((await saveEndpoint(crossSite)).status, 403);
  await db.query("UPDATE workspace_membership SET role='VIEWER' WHERE user_id=$1", [first.userId]);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", latest))).status, 403);
  await db.query("UPDATE workspace_membership SET role='MEMBER' WHERE user_id=$1", [first.userId]);
  const brand = { company: "Test business", tagline: "", companyAddress: "", businessIdentifier: "", brand: "#7240c4", payment: "", logo: "" };
  assert.equal((await preferencesEndpoint(request("/api/workspace/state", "POST", { revision: 0, brand }))).status, 403);
  await db.query("UPDATE workspace_membership SET role='OWNER' WHERE user_id=$1", [first.userId]);
  const archived = await archiveEndpoint(request(`/api/invoices/${saved.id}`, "DELETE", { revision: 2 }), context); assert.equal(archived.status, 200);
  const retained = (await archived.json()).invoice; assert.equal(retained.revision, 3);
  const state = await (await stateEndpoint(request("/api/workspace/state"))).json(); assert.equal(state.drafts.length, 2);
  assert.equal((await saveEndpoint(request("/api/invoices", "POST", retained))).status, 200);
  assert.equal((await db.query("SELECT revision FROM invoice_revision WHERE invoice_id=$1", [saved.id])).rows.length, 4);
  await assert.rejects(db.query("DELETE FROM workspace_audit WHERE workspace_id=$1", [first.workspaceId]), /append-only/);
  await assert.rejects(db.query("UPDATE invoice_revision SET revision=9 WHERE invoice_id=$1", [saved.id]), /append-only/);
  assert.equal((await preferencesEndpoint(request("/api/workspace/state", "POST", { revision: 0, brand }))).status, 200);
  assert.equal((await preferencesEndpoint(request("/api/workspace/state", "POST", { revision: 0, brand }))).status, 409);
  const summary = await invoiceSummary(first.workspaceId); assert.equal(summary.reduce((sum, row) => sum + row.count, 0), 3);
  assert.equal((await privacyRequest(request("/api/workspace/privacy", "POST", { kind: "deletion" }))).status, 201);
  assert.equal((await privacyExport(request("/api/workspace/privacy"))).status, 403);
  // Financial-service fixture proof; real enrollment/recovery is tested separately through the HTTP facade.
  await db.query("UPDATE auth_user SET two_factor_enabled=TRUE WHERE id=$1", [first.userId]);
  await db.query("INSERT INTO auth_assurance(session_id,user_id,method) SELECT id,user_id,'totp' FROM auth_session WHERE user_id=$1", [first.userId]);
  const exported = await (await privacyExport(request("/api/workspace/privacy"))).json(); assert.equal(exported.requests[0].status, "pending"); assert.equal(exported.invoices.length, 3); assert.ok(!JSON.stringify(exported).includes("session_token"));
}));

test("server PDFs preserve narrative text, exact totals, page breaks and a canonical retained revision", async () => setup(async ({ db, directory, first, second, request }) => {
  const draft = invoice(); draft.sections[0].details = ("A carefully documented service description with clear deliverables. ").repeat(100);
  const saved = (await (await saveEndpoint(request("/api/invoices", "POST", draft))).json()).invoice;
  const context = { params: Promise.resolve({ id: saved.id }) };
  assert.equal((await pdfEndpoint(request(`/api/invoices/${saved.id}/pdf`, "GET", undefined, second.cookie), context)).status, 404);
  const firstPdf = await pdfEndpoint(request(`/api/invoices/${saved.id}/pdf`), context); assert.equal(firstPdf.status, 200, await firstPdf.clone().text());
  const bytes = Buffer.from(await firstPdf.arrayBuffer());
  const again = Buffer.from(await (await pdfEndpoint(request(`/api/invoices/${saved.id}/pdf`), context)).arrayBuffer()); assert.deepEqual(bytes, again);
  assert.equal((await db.query("SELECT id FROM generated_pdf WHERE workspace_id=$1", [first.workspaceId])).rows.length, 1);
  const parser = new PDFParse({ data: bytes });
  try { const info = await parser.getInfo(); assert.ok(info.total >= 2); const text = (await parser.getText()).text; assert.ok(text.includes("Design consultation")); assert.ok(text.includes("AUD 330.00")); assert.ok(text.includes("Revision 1")); }
  finally { await parser.destroy(); }
  await mkdir("tmp/pdfs", { recursive: true }); await writeFile("tmp/pdfs/backend-invoice-review.pdf", bytes);
  const privateKey = randomBytes(32).toString("hex"), backup = await encryptedLocalBackup(db, directory, privateKey);
  assert.ok(!backup.includes(Buffer.from("Sample Client")));
  const target = path.join(directory, "restored"), restored = await restoreLocalBackup(backup, target, privateKey);
  try {
    const rows = (await restored.query("SELECT payload FROM created_invoice WHERE workspace_id=$1", [first.workspaceId])).rows;
    assert.equal(rows[0].payload.totalCents, "33000");
    const object = (await restored.query("SELECT id FROM generated_pdf WHERE workspace_id=$1", [first.workspaceId])).rows[0];
    assert.deepEqual(await readFile(path.join(target, "documents", object.id)), bytes);
  } finally { await restored.close(); }
  await assert.rejects(restoreLocalBackup(backup, target, privateKey), /exist/i);
  const damaged = Buffer.from(backup); damaged[damaged.length - 1] ^= 1;
  await assert.rejects(restoreLocalBackup(damaged, path.join(directory, "damaged"), privateKey), /integrity/i);
  const unsupported = invoice(); unsupported.form.notes = "Unsupported emoji: \u{1f600}";
  await assert.rejects(renderInvoicePdf(unsupported), /font cannot display/);
  const legacy = invoice({ format: "table", sections: undefined, items: [{ id: 1, description: "Consultation service", details: "Legacy template line item", quantity: "3", rate: "100" }] });
  const tableBytes = await renderInvoicePdf(legacy); await writeFile("tmp/pdfs/backend-table-review.pdf", tableBytes);
  const tableParser = new PDFParse({ data: tableBytes });
  try { const text = (await tableParser.getText()).text; assert.ok(text.includes("RATE")); assert.ok(text.includes("Consultation service")); assert.ok(text.includes("AUD 330.00")); }
  finally { await tableParser.destroy(); }
}));

test("quarantined originals block access on scanner failure and detect modified stored bytes", async () => setup(async ({ first, directory, db }) => {
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\invoiceflow-test-${randomUUID()}` : path.join(directory, "scanner.sock");
  const previous = process.env.INVOICEFLOW_CLAMAV_SOCKET;
  let infected = false, observed = false;
  const server = createServer(socket => {
    let input = Buffer.alloc(0);
    socket.on("data", bytes => {
      input = Buffer.concat([input, bytes]);
      if (input.length < 10 || input.subarray(0, 10).toString() !== "zINSTREAM\0") return;
      let offset = 10;
      while (offset + 4 <= input.length) { const length = input.readUInt32BE(offset); if (!length) { observed = true; socket.end(infected ? "stream: Test-Signature FOUND\0" : "stream: OK\0"); return; } if (offset + 4 + length > input.length) return; offset += 4 + length; }
    });
  });
  await new Promise(resolve => server.listen(socketPath, resolve)); process.env.INVOICEFLOW_CLAMAV_SOCKET = socketPath;
  try {
    const id = randomUUID(), bytes = Buffer.from("synthetic original file");
    await storeOriginal(first.workspaceId, id, bytes); assert.ok(observed); assert.deepEqual(await readOriginal(first.workspaceId, id), bytes);
    await writeFile(path.join(directory, "documents", id), Buffer.from("altered")); await assert.rejects(readOriginal(first.workspaceId, id), /integrity/);
    infected = true; const blockedId = randomUUID(); await assert.rejects(storeOriginal(first.workspaceId, blockedId, bytes), /blocked/);
    assert.equal((await db.query("SELECT scan_status FROM stored_object WHERE id=$1", [blockedId])).rows[0].scan_status, "blocked");
    await assert.rejects(readOriginal(first.workspaceId, blockedId), /scanning/);
  } finally { await new Promise(resolve => server.close(resolve)); if (previous === undefined) delete process.env.INVOICEFLOW_CLAMAV_SOCKET; else process.env.INVOICEFLOW_CLAMAV_SOCKET = previous; }
}));

test("production requires explicit configuration and verified PostgreSQL TLS; multipart limits count actual bytes", async () => {
  const originalNode = process.env.NODE_ENV, originalUrl = process.env.DATABASE_URL, originalOrigin = process.env.BETTER_AUTH_URL;
  try {
    process.env.NODE_ENV = "production"; delete process.env.BETTER_AUTH_URL;
    assert.throws(() => assertProductionConfigured(), /HTTPS/);
    process.env.BETTER_AUTH_URL = "http://example.test"; assert.throws(() => applicationOrigin(), /HTTPS/);
    process.env.BETTER_AUTH_URL = "https://example.test"; assert.throws(() => assertProductionConfigured(), /not configured/);
    process.env.DATABASE_URL = "postgresql://test-user:test-password@db.example.test/test?sslmode=no-verify&sslrootcert=ignored";
    const options = postgresOptions(); assert.equal(options.ssl.rejectUnauthorized, true); assert.ok(!options.connectionString.includes("sslmode")); assert.ok(!options.connectionString.includes("sslrootcert"));
  } finally {
    for (const [name, value] of [["NODE_ENV", originalNode], ["DATABASE_URL", originalUrl], ["BETTER_AUTH_URL", originalOrigin]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
  const request = new Request(`${origin}/api/vault`, { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body: "--test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\r\n123456789\r\n--test--\r\n" });
  await assert.rejects(boundedMultipart(request, 10), /file-size limit/);
  const malformed = invoice(); malformed.form.issued = malformed.issued = "2026-02-30"; assert.throws(() => validateInvoice(malformed), /dates/);
});

