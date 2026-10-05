import test from "node:test";
import assert from "node:assert/strict";
import { setWorkspaceScope, saveBrand, readBrand } from "../lib/local-data.ts";
import { money } from "../app/components/money.ts";
import { boundedJson } from "../lib/server/request-body.ts";
test("workspace browser storage excludes legacy and other account branding without deleting it", () => {
  const previous = globalThis.window;
  const values = new Map([
    ["tcs-invoiceflow-brand", JSON.stringify({ company: "Legacy company" })],
  ]);
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: () => {},
  };
  const brand = {
    company: "Business A",
    tagline: "",
    companyAddress: "",
    businessIdentifier: "",
    brand: "#7240c4",
    payment: "",
    logo: "",
  };
  try {
    setWorkspaceScope("account-a:business-a");
    assert.equal(readBrand(), null);
    saveBrand(brand);
    setWorkspaceScope("account-b:business-b");
    assert.equal(readBrand(), null);
    saveBrand({ ...brand, company: "Business B" });
    setWorkspaceScope("account-a:business-a");
    assert.equal(readBrand().company, "Business A");
    setWorkspaceScope(null);
    assert.equal(readBrand(), null);
    assert.throws(() => saveBrand(brand));
    assert.ok(values.has("tcs-invoiceflow-brand"));
  } finally {
    setWorkspaceScope(null);
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
test("money formats negative differences including values below a dollar without floating point conversion", () => {
  assert.equal(money(-50n, "AUD"), "-$0.50");
  assert.equal(money(-3055n, "AUD"), "-$30.55");
  assert.equal(money(0n, "AUD"), "$0.00");
  assert.equal(money(33_61n, "AUD"), "$33.61");
});
test("JSON body limits apply to streamed requests and reject null or malformed JSON", async () => {
  const request = (body) =>
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  await assert.rejects(
    () => boundedJson(request(JSON.stringify({ value: "x".repeat(100) })), 20),
    (error) => error.status === 413,
  );
  await assert.rejects(
    () => boundedJson(request("null"), 100),
    (error) => error.status === 400,
  );
  await assert.rejects(
    () => boundedJson(request("{bad"), 100),
    (error) => error.status === 400,
  );
  assert.deepEqual(await boundedJson(request('{"value":1}'), 100), {
    value: 1,
  });
});
