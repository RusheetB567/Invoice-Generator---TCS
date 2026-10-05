import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { inspectXlsx, readXlsx } from "../lib/server/xlsx-reader.ts";
import { createImport, getImport, commitImport, listImports } from "../lib/server/spreadsheet-import.ts";
import { database, listDocuments, originalFile } from "../lib/server/vault.ts";
import { draftFromRow, draftIssues, matchColumns } from "../lib/domain/spreadsheet-records.ts";
import { exportVault } from "../lib/server/vault-export.ts";
import { importTemplate } from "../lib/server/import-template.ts";
const headers = ["Supplier / customer", "Invoice number", "Invoice date", "Total", "GST on document", "Type", "Business use %"];
async function fixture() {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Records");
  sheet.addRow(headers);
  sheet.addRow(["Example", "0001", new Date("2026-07-01T00:00:00Z"), 110, 10, "Expense", .75]);
  sheet.addRow(["Example", "0002", "02/07/2026", 22, 2, "Expense", 50]);
  sheet.addRow(["Example", "0001", "2026-07-01", 999, 0, "Expense", 100]);
  sheet.getCell("C2").numFmt = "dd/mm/yyyy"; sheet.getCell("G2").numFmt = "0.0%"; sheet.getCell("G3").numFmt = '0.00"%"';
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
test("Excel import preserves identifiers, typed dates, percent formats and conservative defaults", async () => {
  const [sheet] = await readXlsx(await fixture()), mapping = matchColumns(sheet.headers);
  const first = draftFromRow(sheet.rows[0], mapping), second = draftFromRow(sheet.rows[1], mapping);
  assert.equal(first.number, "0001"); assert.equal(first.issued, "2026-07-01"); assert.equal(first.businessPercent, "75");
  assert.equal(second.issued, "2026-07-02"); assert.equal(second.businessPercent, "50", "a literal percent suffix must not multiply the value");
  assert.equal(first.claimGst, false); assert.equal(first.gstRegistered, false); assert.equal(first.confirmed, false); assert.equal(first.treatment, "Needs tax review");
  assert.deepEqual(draftIssues(first), []);
  const missing = draftFromRow({ number: 2, cells: [] }, mapping);
  assert.equal(missing.gst, ""); assert.equal(missing.businessPercent, "0"); assert.ok(draftIssues(missing).length > 0);
});
test("formula cells are never imported from cached totals; numeric zero-padded IDs survive", async () => {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Records"); sheet.addRow(headers);
  sheet.addRow(["=Plain text supplier", 1, "2026-07-01", { formula: "1+109", result: 110 }, 10, "Expense", 100]); sheet.getCell("B2").numFmt = "0000";
  const [read] = await readXlsx(Buffer.from(await workbook.xlsx.writeBuffer())), draft = draftFromRow(read.rows[0], matchColumns(read.headers));
  assert.equal(draft.supplier, "=Plain text supplier"); assert.equal(draft.number, "0001"); assert.equal(draft.total, ""); assert.ok(draftIssues(draft).some(issue => issue.startsWith("Total")));
});
test("ambiguous headers and unsupported financial values need human correction", () => {
  assert.equal(matchColumns(["Supplier", "Vendor", "Invoice number"]).supplier, null);
  const mapping = matchColumns([...headers, "Currency"]), row = { number: 2, cells: ["Example", "1", "2026-02-30", "-110", "0", "Expense", "120", "USD"].map(value => ({ value })) };
  const issues = draftIssues(draftFromRow(row, mapping));
  assert.ok(issues.some(issue => issue.startsWith("Invoice date"))); assert.ok(issues.some(issue => issue.startsWith("Total"))); assert.ok(issues.some(issue => issue.startsWith("Business use"))); assert.ok(issues.some(issue => issue.startsWith("Currency")));
});
// A small ZIP fixture with real deflate bytes makes decompression/range checks independent of ExcelJS.
function archive(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [name, content] of entries) {
    const label = Buffer.from(name), raw = Buffer.from(content), zipped = deflateRawSync(raw), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(zipped.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(label.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(zipped.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(label.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, label, zipped); centrals.push(central, label); offset += local.length + label.length + zipped.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const basic = xml => [["[Content_Types].xml", "<Types/>"], ["xl/workbook.xml", "<workbook/>"], ["xl/worksheets/sheet1.xml", xml]];
test("workbooks reject disguised files, ZIP expansion, DTDs, macros and sparse huge ranges", () => {
  assert.throws(() => inspectXlsx(Buffer.from("not an xlsx")));
  assert.throws(() => inspectXlsx(Buffer.alloc(5 * 1024 * 1024 + 1)));
  assert.throws(() => inspectXlsx(archive(basic("<!DOCTYPE sheet [<!ENTITY x SYSTEM 'file:///secret'>]><sheet/>"))));
  assert.throws(() => inspectXlsx(archive([...basic("<sheet/>"), ["xl/vbaProject.bin", "macro"]])));
  assert.throws(() => inspectXlsx(archive(basic("<sheet><row r='1048576'><c r='XFD1048576'/></row></sheet>"))));
  assert.throws(() => inspectXlsx(archive(basic('<sheet><mergeCell ref="A1:AN999999"/></sheet>'))));
  assert.throws(() => inspectXlsx(archive(basic(Buffer.alloc(26 * 1024 * 1024, 65)))));
});
test("import template contains typed columns and supported Excel dropdowns", async () => {
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await importTemplate()); const sheet = workbook.getWorksheet("Records");
  assert.equal(sheet.getCell("B1").value, "Invoice number"); assert.equal(sheet.getColumn(2).numFmt, "@"); assert.equal(sheet.getColumn(3).numFmt, "dd/mm/yyyy");
  assert.equal(sheet.getCell("G2").dataValidation.type, "list"); assert.ok(sheet.getCell("G2").dataValidation.formulae[0].length < 255);
  assert.ok(workbook.getWorksheet("Guide").getCell("B4").value.includes("never automatically"));
});
test("reviewed imports are atomic, scoped, idempotent, resumable and keep exact originals", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "invoiceflow-import-test-")), previous = process.env.INVOICEFLOW_DATA_DIR; process.env.INVOICEFLOW_DATA_DIR = directory;
  let db;
  try {
    db = await database(); const a = "00000000-0000-4000-8000-000000000041", b = "00000000-0000-4000-8000-000000000042";
    for (const id of [a,b]) await db.query("INSERT INTO business_workspace(id,name,onboarding_complete) VALUES($1,$2,true)", [id, "Disposable import fixture"]);
    const bytes = await fixture(), created = await createImport(a, bytes, "records.xlsx"), batch = created.batch, sheet = batch.sheets[0], mapping = matchColumns(sheet.headers);
    assert.equal((await listDocuments(a)).length, 0, "upload alone creates no financial records");
    assert.equal((await createImport(a, bytes, "records.xlsx")).duplicate, true);
    await assert.rejects(() => getImport(b, batch.id), error => error.status === 404);
    const rows = sheet.rows.map(row => ({ number: row.number, record: { ...draftFromRow(row, mapping), confirmed: true } }));
    await assert.rejects(() => commitImport(a, batch.id, { sheet: sheet.name, reviewed: true, rows: [rows[0], { ...rows[1], record: { ...rows[1].record, total: "bad" } }] }), error => error.status === 422);
    assert.equal((await listDocuments(a)).length, 0);
    const first = await commitImport(a, batch.id, { sheet: sheet.name, reviewed: true, rows: [rows[0]] }); assert.equal(first.saved, 1);
    const later = await commitImport(a, batch.id, { sheet: sheet.name, reviewed: true, rows: rows.slice(1) }); assert.equal(later.saved, 1); assert.equal(later.duplicates, 1);
    const retried = await commitImport(a, batch.id, { sheet: sheet.name, reviewed: true, rows }); assert.equal(retried.saved, 0); assert.equal(retried.duplicates, 3);
    const documents = await listDocuments(a); assert.equal(documents.length, 2); assert.equal(documents.find(doc => doc.record.number === "0001").record.total, "110");
    assert.deepEqual(await originalFile(a, documents[0].id), bytes); assert.equal(documents[0].source.fileHash, createHash("sha256").update(bytes).digest("hex"));
    assert.equal((await listImports(a))[0].saved, 3); assert.deepEqual(await listImports(b), []);
    const other = await createImport(b, bytes, "records.xlsx"); assert.notEqual(other.batch.id, batch.id); await commitImport(b, other.batch.id, { sheet: sheet.name, reviewed: true, rows: [rows[0]] }); assert.equal((await listDocuments(b)).length, 1);
    const exported = Buffer.from(await exportVault(documents, { name: "Fixture company", businessNumber: "Identifier text" })); const [roundtrip] = await readXlsx(exported); const again = draftFromRow(roundtrip.rows[0], matchColumns(roundtrip.headers));
    assert.equal(again.issued, documents[0].record.issued); assert.equal(again.businessPercent, documents[0].record.businessPercent); assert.deepEqual(draftIssues(again), []);
  } finally {
    if (db) await db.close(); if (previous === undefined) delete process.env.INVOICEFLOW_DATA_DIR; else process.env.INVOICEFLOW_DATA_DIR = previous;
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir())); assert.ok(path.basename(directory).startsWith("invoiceflow-import-test-")); await rm(directory, { recursive: true, force: true });
  }
});
