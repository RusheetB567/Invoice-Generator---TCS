import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getAuth } from "../lib/server/auth.ts";
import {
  database,
  storeDocument,
  getDocument,
  originalFile,
  listDocuments,
  confirmDocument,
} from "../lib/server/vault.ts";
import {
  currentIdentity,
  requireWorkspace,
  createWorkspace,
  findWorkspace,
  finishOnboarding,
  sameOriginWrite,
} from "../lib/server/workspaces.ts";
import { businessProfileSchema } from "../lib/domain/business.ts";
import { POST as calculateTaxEndpoint } from "../app/api/tax/calculate/route.ts";
import ExcelJS from "exceljs";
import { POST as uploadWorkbook } from "../app/api/vault/imports/route.ts";
import { GET as readWorkbook, POST as approveWorkbook } from "../app/api/vault/imports/[id]/route.ts";
import { GET as exportRecords } from "../app/api/vault/export/route.ts";
import {
  listContacts,
  saveContact,
  archiveContact,
} from "../lib/server/directory.ts";

test("real signup, private onboarding, tenant isolation and revoked sessions", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "invoiceflow-accounts-test-"),
  );
  const oldDir = process.env.INVOICEFLOW_DATA_DIR,
    oldEnv = process.env.NODE_ENV;
  process.env.INVOICEFLOW_DATA_DIR = directory;
  process.env.NODE_ENV = "test";
  let db;
  try {
    const auth = await getAuth("http://localhost:3199");
    db = await database();
    const send = (endpoint, body, cookie = "") =>
      auth.handler(
        new Request(`http://localhost:3199/api/auth/${endpoint}`, {
          method: body ? "POST" : "GET",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3199",
            cookie,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    const fixture = {
      firstName: "Review",
      lastName: "Tester",
      name: "Review Tester",
      email: "owner@example.test",
      password: "Disposable test passphrase 2026!",
    };
    const weak = await send("sign-up/email", { ...fixture, password: "short" });
    assert.equal(weak.ok, false);
    const created = await send("sign-up/email", fixture);
    assert.equal(created.status, 200, await created.clone().text());
    const cookies = created.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    assert.ok(cookies.includes("session_token"));
    const value = await created.json();
    assert.equal(value.user.firstName, "Review");
    assert.equal(value.user.emailVerified, false);
    const stored = await db.query(
      "SELECT password FROM auth_account WHERE user_id=$1",
      [value.user.id],
    );
    assert.notEqual(stored.rows[0].password, fixture.password);
    assert.ok(stored.rows[0].password.length > 64);
    assert.equal((await send("sign-up/email", fixture)).ok, false);
    assert.equal(
      (
        await send("sign-in/email", {
          email: fixture.email,
          password: "incorrect passphrase",
        })
      ).ok,
      false,
    );
    const request = new Request("http://localhost:3199/api/vault", {
      headers: { cookie: cookies },
    });
    await assert.rejects(
      () => requireWorkspace(request),
      (error) => error.status === 409,
    );
    const workspaceA = await createWorkspace(
      value.user.id,
      "Review organisation",
    );
    await assert.rejects(
      () => createWorkspace(value.user.id, "Duplicate"),
      (error) => error.status === 409,
    );
    const profile = businessProfileSchema.parse({
      legalName: "Review organisation",
      address: "",
      country: "Australia",
      businessNumber: "",
      currency: "AUD",
      industry: "Technology",
      gstRegistered: false,
      accent: "#7240c4",
      payment: "",
    });
    await finishOnboarding(value.user.id, profile);
    assert.equal((await requireWorkspace(request)).workspace.id, workspaceA);
    const taxBody = { income: "80000", frequency: "annual", financialYear: "2026-27", employment: "employee", residency: "resident", hoursPerWeek: 38, weeksPerYear: 52, daysPerWeek: 5 };
    const taxRequest = (body, cookie = cookies, origin = "http://localhost:3199") => new Request("http://localhost:3199/api/tax/calculate", { method: "POST", headers: { "content-type": "application/json", origin, cookie }, body: JSON.stringify(body) });
    assert.equal((await calculateTaxEndpoint(taxRequest(taxBody, ""))).status, 401);
    assert.equal((await calculateTaxEndpoint(taxRequest(taxBody, cookies, "https://example.test"))).status, 403);
    assert.equal((await calculateTaxEndpoint(taxRequest({ ...taxBody, income: "-1" }))).status, 422);
    assert.equal((await calculateTaxEndpoint(taxRequest({ ...taxBody, income: "9".repeat(5000) }))).status, 413);
    assert.equal((await calculateTaxEndpoint(taxRequest({ ...taxBody, netCents: 8000000 }))).status, 422);
    const taxResponse = await calculateTaxEndpoint(taxRequest(taxBody));
    assert.equal(taxResponse.status, 200);
    assert.equal(taxResponse.headers.get("cache-control"), "no-store");
    assert.equal((await taxResponse.json()).result.netCents, 6388000);
    const second = await send("sign-up/email", {
      ...fixture,
      email: "other@example.test",
    });
    assert.equal(second.ok, true);
    const other = await second.json();
    const workspaceB = await createWorkspace(other.user.id, "Other business");
    await finishOnboarding(other.user.id, profile);
    assert.notEqual((await findWorkspace(other.user.id)).id, workspaceA);
    const contact = {
      kind: "Client",
      name: "Business A client",
      email: "client@example.test",
      businessNumber: "",
      address: "",
      notes: "",
    };
    const contactId = await saveContact(workspaceA, contact);
    assert.equal((await listContacts(workspaceB)).length, 0);
    await assert.rejects(
      () => saveContact(workspaceB, { ...contact, name: "Changed" }, contactId),
      (error) => error.status === 404,
    );
    await assert.rejects(
      () => archiveContact(workspaceB, contactId),
      (error) => error.status === 404,
    );
    await archiveContact(workspaceA, contactId);
    assert.equal((await listContacts(workspaceA))[0].archived, true);
    await archiveContact(workspaceA, contactId, false);
    assert.equal((await listContacts(workspaceA))[0].archived, false);
    const bytes = Buffer.from("Disposable invoice evidence"),
      document = {
        name: "fixture.pdf",
        mime: "application/pdf",
        status: "Review",
        method: "Manual review",
        text: "",
        candidate: {
          supplier: "Fixture",
          number: "001",
          issued: "2026-07-01",
          total: "11.00",
          gst: "1.00",
        },
        notice: "",
        record: null,
      };
    const first = await storeDocument(workspaceA, bytes, document);
    const otherCopy = await storeDocument(workspaceB, bytes, document);
    assert.notEqual(first.document.id, otherCopy.document.id);
    assert.equal(otherCopy.duplicate, false);
    assert.equal((await listDocuments(workspaceB)).length, 1);
    await assert.rejects(
      () => getDocument(workspaceB, first.document.id),
      (error) => error.status === 404,
    );
    await assert.rejects(
      () => originalFile(workspaceB, first.document.id),
      (error) => error.status === 404,
    );
    await assert.rejects(
      () => confirmDocument(workspaceB, first.document.id, {}),
      (error) => error.status === 404,
    );
    assert.deepEqual(await originalFile(workspaceA, first.document.id), bytes);
    const legacyId = "00000000-0000-4000-8000-000000000009";
    await db.query(
      "INSERT INTO vault_documents(id,hash,filename,payload) VALUES($1,$2,$3,$4)",
      [
        legacyId,
        "old-hash",
        "legacy.pdf",
        JSON.stringify({ ...document, id: legacyId }),
      ],
    );
    assert.equal((await listDocuments(workspaceA)).length, 1);
    await assert.rejects(
      () => getDocument(workspaceA, legacyId),
      (error) => error.status === 404,
    );
    process.env.NODE_ENV = "development";
    const workbook = new ExcelJS.Workbook(), worksheet = workbook.addWorksheet("Records");
    worksheet.addRow(["Supplier", "Invoice number", "Invoice date", "Total", "GST"]);
    worksheet.addRow(["API fixture", "API-001", "2026-07-01", 110, 10]);
    const workbookBytes = await workbook.xlsx.writeBuffer();
    const workbookHeaders = { cookie: cookies, origin: "http://localhost:3199", "x-invoiceflow-vault": "local", "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    const upload = () => new Request("http://localhost:3199/api/vault/imports?name=fixture.xlsx", { method: "POST", headers: workbookHeaders, body: workbookBytes });
    const uploaded = await uploadWorkbook(upload()); assert.equal(uploaded.status, 201);
    const batch = (await uploaded.json()).batch, context = { params: Promise.resolve({ id: batch.id }) };
    const otherCookieForImport = second.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    assert.equal((await readWorkbook(new Request(`http://localhost:3199/api/vault/imports/${batch.id}`, { headers: { cookie: otherCookieForImport } }), context)).status, 404);
    assert.equal((await uploadWorkbook(new Request("http://localhost:3199/api/vault/imports?name=fixture.xlsx", { method: "POST", headers: { "x-invoiceflow-vault": "local" }, body: workbookBytes }))).status, 401);
    assert.equal((await uploadWorkbook(new Request("http://localhost:3199/api/vault/imports?name=fixture.xlsx", { method: "POST", headers: { ...workbookHeaders, origin: "https://foreign.example" }, body: workbookBytes }))).status, 403);
    const approved = await approveWorkbook(new Request(`http://localhost:3199/api/vault/imports/${batch.id}`, { method: "POST", headers: { ...workbookHeaders, "content-type": "application/json" }, body: JSON.stringify({ sheet: "Records", reviewed: true, rows: [{ number: 2, record: { supplier: "API fixture", number: "API-001", issued: "2026-07-01", total: "110", gst: "10", kind: "Expense", category: "Other", treatment: "Needs tax review", businessPercent: "0", gstRegistered: false, claimGst: false, currency: "AUD", notes: "", confirmed: true } }] }) }), context);
    assert.equal(approved.status, 200); const importedId = (await approved.json()).ids[0];
    const download = await exportRecords(new Request(`http://localhost:3199/api/vault/export?ids=${importedId}`, { headers: { cookie: cookies } })); assert.equal(download.status, 200); assert.equal(download.headers.get("cache-control"), "no-store");
    const exportedWorkbook = new ExcelJS.Workbook(); await exportedWorkbook.xlsx.load(await download.arrayBuffer()); assert.equal(exportedWorkbook.getWorksheet("Records").getCell("C2").value, "API-001");
    assert.deepEqual(await originalFile(workspaceA, importedId), Buffer.from(workbookBytes));
    process.env.NODE_ENV = "test";
    await db.query(
      "UPDATE workspace_membership SET role='VIEWER' WHERE user_id=$1",
      [other.user.id],
    );
    const otherCookies = second.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    await assert.rejects(
      () =>
        requireWorkspace(
          new Request("http://localhost:3199/api/vault", {
            headers: { cookie: otherCookies },
          }),
          true,
        ),
      (error) => error.status === 403,
    );
    assert.throws(() =>
      sameOriginWrite(
        new Request("http://localhost:3199/api/workspace", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    );
    assert.equal((await send("sign-out", {}, cookies)).ok, true);
    await assert.rejects(
      () => currentIdentity(request),
      (error) => error.status === 401,
    );
    const login = await send("sign-in/email", {
      email: fixture.email,
      password: fixture.password,
    });
    assert.equal(login.ok, true);
    const activeCookie = login.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const anotherLogin = await send("sign-in/email", {
      email: fixture.email,
      password: fixture.password,
    });
    assert.equal(anotherLogin.ok, true);
    const anotherCookie = anotherLogin.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    const updated = await send(
      "update-user",
      { firstName: "Updated", lastName: "Tester", name: "Updated Tester" },
      activeCookie,
    );
    assert.equal(updated.ok, true);
    assert.equal(
      (
        await currentIdentity(
          new Request("http://localhost:3199/api", {
            headers: { cookie: activeCookie },
          }),
        )
      ).user.firstName,
      "Updated",
    );
    const badChange = await send(
      "change-password",
      {
        currentPassword: "Wrong passphrase",
        newPassword: "A changed disposable password 2026!",
        revokeOtherSessions: true,
      },
      activeCookie,
    );
    assert.equal(badChange.ok, false);
    const change = await send(
      "change-password",
      {
        currentPassword: fixture.password,
        newPassword: "A changed disposable password 2026!",
        revokeOtherSessions: true,
      },
      activeCookie,
    );
    assert.equal(change.ok, true);
    await assert.rejects(
      () =>
        currentIdentity(
          new Request("http://localhost:3199/api", {
            headers: { cookie: anotherCookie },
          }),
        ),
      (error) => error.status === 401,
    );
    assert.equal(
      (
        await send("sign-in/email", {
          email: fixture.email,
          password: fixture.password,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await send("sign-in/email", {
          email: fixture.email,
          password: "A changed disposable password 2026!",
        })
      ).ok,
      true,
    );
  } finally {
    if (db) await db.close();
    if (oldDir === undefined) delete process.env.INVOICEFLOW_DATA_DIR;
    else process.env.INVOICEFLOW_DATA_DIR = oldDir;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(
      path.basename(directory).startsWith("invoiceflow-accounts-test-"),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
