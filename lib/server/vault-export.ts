import ExcelJS from "exceljs";
import { allocations, financialYear, type VaultDocument } from "../domain/tax-record";
import { hundredths } from "../domain/invoice-math";
export async function exportVault(input: VaultDocument[], context: { name?: string; businessNumber?: string; selection?: string } = {}) {
  const documents = input.filter(document => document.record?.confirmed);
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
  summary.addRow(["Business", context.name || "Business workspace"]);
  summary.addRow(["Business number", context.businessNumber || "Not entered"]);
  summary.addRow(["Export selection", context.selection || "Confirmed records"]);
  summary.addRow(["For your tax agent", "A review pack, not an ATO lodgement file. Income/expense totals are invoice-date records, not taxable profit or cash-basis BAS totals."]);
  summary.addRow(["Spreadsheet evidence", "An imported workbook is retained as the source. Underlying invoices/receipts may still be required."]);
  summary.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  for (let row = 4; row <= 7; row++) summary.getCell(row, 2).numFmt = '"A$"#,##0.00';
  summary.getRow(9).height = 35; summary.getRow(10).height = 35;
  const sheet = workbook.addWorksheet("Records", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = ["Record ID", "Supplier / customer", "Invoice number", "Invoice date", "Financial year", "Type", "Category", "GST treatment", "Currency", "Total", "GST on document", "Business use %", "GST registered", "GST credit selected", "Business portion", "GST credit estimate", "Cost after GST credit", "Original filename", "Source SHA-256", "Reading method", "Notes", "Source sheet", "Source row"];
  sheet.addRow(headers);
  for (const doc of documents) {
    const r = doc.record!; const a = allocations(r);
    sheet.addRow([doc.id, r.supplier, r.number, new Date(`${r.issued}T00:00:00Z`), financialYear(r.issued), r.kind, r.category, r.treatment, r.currency, Number(r.total), Number(r.gst), Number(r.businessPercent) / 100, r.gstRegistered ? "Yes" : "No", r.claimGst ? "Yes" : "No", Number(a.allocated) / 100, Number(a.credit) / 100, Number(a.costExCredit) / 100, doc.name, doc.source?.fileHash || doc.hash, doc.method, r.notes, doc.source?.sheet || "", doc.source?.row ?? ""]);
  }
  sheet.columns.forEach((column, index) => { column.width = [0,18].includes(index) ? 40 : [1,6,7,17,20].includes(index) ? 28 : 20; });
  for (const column of [10,11,15,16,17]) sheet.getColumn(column).numFmt = '"A$"#,##0.00';
  sheet.getColumn(4).numFmt = "dd/mm/yyyy";
  sheet.getColumn(12).numFmt = "0.0%";
  sheet.autoFilter = { from: "A1", to: "W1" };
  sheet.eachRow((row, index) => { row.alignment = { vertical: "top", wrapText: true }; if (index > 1) { row.height = 32; if (index % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EFFA" } }; } });
  const tax = workbook.addWorksheet("Tax summary", { views: [{ state: "frozen", ySplit: 1 }] });
  tax.addRow(["Financial year", "Type", "Category", "Record count", "Document total (AUD)", "GST shown (AUD)", "Business portion (AUD)", "Selected GST credit (AUD)", "Cost after credit (AUD)"]);
  const groups = new Map<string, { year: string; kind: string; category: string; count: number; total: bigint; gst: bigint; business: bigint; credit: bigint; cost: bigint }>();
  for (const doc of documents) {
    const r = doc.record!, year = financialYear(r.issued), key = JSON.stringify([year, r.kind, r.category]);
    const group = groups.get(key) ?? { year, kind: r.kind, category: r.category, count: 0, total: BigInt(0), gst: BigInt(0), business: BigInt(0), credit: BigInt(0), cost: BigInt(0) }, amounts = allocations(r);
    group.count++; group.total += hundredths(r.total, BigInt(9999999))!; group.gst += hundredths(r.gst, BigInt(9999999))!; group.business += amounts.allocated; group.credit += amounts.credit; group.cost += amounts.costExCredit; groups.set(key, group);
  }
  for (const group of [...groups.values()].sort((a, b) => `${a.year}${a.kind}${a.category}`.localeCompare(`${b.year}${b.kind}${b.category}`))) tax.addRow([group.year, group.kind, group.category, group.count, Number(group.total)/100, Number(group.gst)/100, Number(group.business)/100, Number(group.credit)/100, Number(group.cost)/100]);
  tax.columns.forEach((column, index) => { column.width = index === 2 ? 32 : index < 4 ? 20 : 25; if (index >= 4) column.numFmt = '"A$"#,##0.00'; });
  tax.autoFilter = { from: "A1", to: "I1" };
  tax.eachRow((row, index) => { row.alignment = { vertical: "middle", wrapText: true }; row.height = index === 1 ? 46 : 34; });
  summary.columns[1].width = 70; summary.getRow(14).height = 56; summary.getRow(15).height = 44;
  for (const page of [summary, sheet, tax]) { page.properties.defaultRowHeight = 22; page.getRow(1).font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; page.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7240C4" } }; if (page !== tax) page.getRow(1).height = 32; page.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; }
  return workbook.xlsx.writeBuffer();
}
