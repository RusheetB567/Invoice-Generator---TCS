import ExcelJS from "exceljs";
import { allocations, financialYear, type VaultDocument } from "../domain/tax-record";
import { hundredths } from "../domain/invoice-math";
export async function exportVault(documents: VaultDocument[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "The Code Squad / InvoiceFlow";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Overview");
  summary.columns = [{ width: 38 }, { width: 25 }];
  summary.addRow(["TCS INVOICEFLOW / RECORDS", "AUD"]);
  summary.addRow(["Exported", new Date().toISOString()]);
  summary.addRow(["Confirmed records", documents.length]);
  const totals = { Income: BigInt(0), Expense: BigInt(0), Personal: BigInt(0), credit: BigInt(0) };
  for (const doc of documents) { const r = doc.record!; totals[r.kind] += hundredths(r.total, BigInt(9999999))!; totals.credit += allocations(r).credit; }
  for (const kind of ["Income", "Expense", "Personal"] as const) summary.addRow([`${kind} / document totals`, Number(totals[kind]) / 100]);
  summary.addRow(["GST credit estimate / selected by user", Number(totals.credit) / 100]);
  summary.addRow(["Basis", "Invoice date; confirmed records only"]);
  summary.addRow(["Tax classification", "User selections; no tax return or BAS lodged"]);
  summary.addRow(["Records", "Original files are retained separately in the local vault"]);
  summary.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  for (let row = 4; row <= 7; row++) summary.getCell(row, 2).numFmt = '"A$"#,##0.00';
  summary.getRow(9).height = 35; summary.getRow(10).height = 35;
  const sheet = workbook.addWorksheet("Records", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = ["Record ID", "Supplier / customer", "Invoice number", "Invoice date", "Financial year", "Type", "Category", "GST treatment", "Currency", "Total", "GST on document", "Business use %", "GST registered", "GST credit selected", "Business portion", "GST credit estimate", "Cost after GST credit", "Original filename", "SHA-256", "Reading method", "Notes"];
  sheet.addRow(headers);
  for (const doc of documents) {
    const r = doc.record!; const a = allocations(r);
    sheet.addRow([doc.id, r.supplier, r.number, r.issued, financialYear(r.issued), r.kind, r.category, r.treatment, r.currency, Number(r.total), Number(r.gst), Number(r.businessPercent), r.gstRegistered ? "Yes" : "No", r.claimGst ? "Yes" : "No", Number(a.allocated) / 100, Number(a.credit) / 100, Number(a.costExCredit) / 100, doc.name, doc.hash, doc.method, r.notes]);
  }
  sheet.columns.forEach((column, index) => { column.width = [0,18].includes(index) ? 40 : [1,6,7,17,20].includes(index) ? 28 : 20; });
  for (const column of [10,11,15,16,17]) sheet.getColumn(column).numFmt = '"A$"#,##0.00';
  sheet.autoFilter = { from: "A1", to: "U1" };
  sheet.eachRow((row, index) => { row.alignment = { vertical: "top", wrapText: true }; if (index > 1) { row.height = 32; if (index % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFFA" } }; } });
  for (const page of [summary, sheet]) { page.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; page.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7240C4" } }; page.getRow(1).height = 30; }
  return workbook.xlsx.writeBuffer();
}
