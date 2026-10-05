import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const css = registerHooks({ load(url, context, next) { if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, {get:(_,key)=>String(key)});" }; return next(url, context); } });
const { default: SpreadsheetSource } = await import("../app/components/records/spreadsheet-source.tsx");
const { default: RecordEditor } = await import("../app/components/records/record-editor.tsx");
css.deregister();
test("workbook source values are plain readable text, escaped and resilient to missing previews", () => {
  const document = { source: { sheet: "Records", row: 2 }, text: JSON.stringify({ cells: [["Supplier", "<script>alert(1)</script>"], ["Invoice number", "0001"], ["Empty", ""]] }) };
  const html = renderToStaticMarkup(createElement(SpreadsheetSource, { document }));
  assert.ok(html.includes("Invoice number")); assert.ok(html.includes("0001")); assert.ok(html.includes("&lt;script&gt;")); assert.equal(html.includes("<script>"), false); assert.equal(html.includes('"cells"'), false); assert.equal(html.includes("Empty"), false);
  const fallback = renderToStaticMarkup(createElement(SpreadsheetSource, { document: { ...document, text: "old text" } })); assert.ok(fallback.includes("Download the workbook"));
});
test("record review layers tax choices and does not preselect a GST claim", () => {
  const draft = { supplier: "Example", number: "1", issued: "2026-07-01", total: "110", gst: "10", kind: "Expense", category: "Other", treatment: "Needs tax review", businessPercent: "0", gstRegistered: false, claimGst: false, currency: "AUD", notes: "", confirmed: false };
  const html = renderToStaticMarkup(createElement(RecordEditor, { draft, disabled: false, onChange() {} }));
  assert.ok(html.includes("Tax selections &amp; notes")); assert.equal(/<details[^>]*\bopen/.test(html), false); assert.equal(html.includes('checked=""'), false); assert.ok(html.includes('type="date"'));
});
