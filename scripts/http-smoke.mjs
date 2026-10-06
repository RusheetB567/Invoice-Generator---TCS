import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.INVOICEFLOW_SMOKE_ORIGIN || "http://127.0.0.1:3207";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw new Error("The smoke test only targets a disposable local installation.");
let cookie = "";
async function call(path, method = "GET", body) {
  return fetch(`${origin}${path}`, { method, redirect: "manual", headers: { origin, cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const privatePage = await call("/workspace"); assert.equal(privatePage.status, 307); assert.ok(privatePage.headers.get("location").includes("sign-in"));
assert.equal((await call("/api/workspace/state")).status, 401);
const signup = await call("/api/auth/sign-up/email", "POST", { firstName: "Smoke", lastName: "Tester", email: `smoke-${randomUUID()}@example.test`, password: "Disposable local test passphrase 2026!" });
assert.equal(signup.status, 200, await signup.clone().text());
cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); assert.ok(cookie.includes("session_token"));
assert.equal((await call("/api/workspace", "POST", { step: "create", name: "HTTP test business" })).status, 200);
assert.equal((await call("/api/workspace", "POST", { step: "profile", profile: { legalName: "HTTP test business", address: "Adelaide", country: "Australia", businessNumber: "", currency: "AUD", industry: "Design", gstRegistered: true, accent: "#7240c4", payment: "" } })).status, 200);
const dashboard = await call("/workspace"); assert.equal(dashboard.status, 200); assert.equal(dashboard.headers.get("x-content-type-options"), "nosniff");
const form = { company: "HTTP test business", tagline: "", companyAddress: "Adelaide", customer: "Synthetic client", customerAddress: "", location: "", number: "", issued: "2026-10-01", due: "2026-10-15", brand: "#7240c4", lineLabel: "Hours", taxLabel: "GST", tax: "10", notes: "Thank you", payment: "", businessIdentifier: "" };
const payload = { id: randomUUID(), revision: 0, number: "", company: form.company, customer: form.customer, currency: "AUD", subtotalCents: "10000", taxCents: "1000", totalCents: "11000", issued: form.issued, due: form.due, status: "Draft", updatedAt: new Date().toISOString(), form, items: [], format: "sections", sections: [{ id: 1, heading: "Design review", details: "Synthetic verification record", amount: "100" }], logo: "" };
const savedResponse = await call("/api/invoices", "POST", payload); assert.equal(savedResponse.status, 200, await savedResponse.clone().text()); const { invoice } = await savedResponse.json(); assert.equal(invoice.totalCents, "11000");
const state = await (await call("/api/workspace/state")).json(); assert.ok(state.drafts.some(value => value.id === invoice.id));
const pdf = await call(`/api/invoices/${invoice.id}/pdf`); assert.equal(pdf.status, 200, await pdf.clone().text()); assert.equal(pdf.headers.get("content-type"), "application/pdf"); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
assert.equal((await call("/api/auth/sign-out", "POST", {})).status, 200);
assert.equal((await call(`/api/invoices/${invoice.id}`)).status, 401);
console.log("HTTP smoke passed: private redirect, signup, onboarding, server invoice save, workspace reload, PDF, headers and sign-out revocation.");
