import ExcelJS from "exceljs";
import { categories, treatments } from "../domain/tax-record";
import { importFields, fieldLabels } from "../domain/spreadsheet-records";
export async function importTemplate() {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "The Code Squad / InvoiceFlow";
  const sheet = workbook.addWorksheet("Records", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(importFields.map(field => fieldLabels[field]));
  sheet.columns.forEach((column, index) => { column.width = [0, 6, 7, 11].includes(index) ? 32 : 23; });
  sheet.getColumn(2).numFmt = "@"; sheet.getColumn(3).numFmt = "dd/mm/yyyy";
  for (const column of [4, 5]) sheet.getColumn(column).numFmt = '"A$"#,##0.00';
  sheet.getColumn(9).numFmt = '0.00"%"';
  const guide = workbook.addWorksheet("Guide"); guide.columns = [{ width: 30 }, { width: 100 }];
  const instructions = [["TCS INVOICEFLOW", "Invoice records import template"], ["Required", "Supplier / customer, Invoice number, Invoice date, Total including GST and GST on document."], ["Invoice numbers", "Enter as text to preserve leading zeros. Dates use dd/mm/yyyy or yyyy-mm-dd."], ["Tax selections", "Optional Type, Category, GST treatment and Business use %. Blank business use starts at 0. GST credit claims are never automatically selected."], ["Business use", "Enter 75 for 75%, or use a percentage-formatted cell containing 0.75."], ["Amounts", "Nonnegative AUD amounts with up to two decimals. Enter 0 GST only when the source document supports it."], ["Supported", "Up to 1,000 data rows, 40 columns, 10 sheets and a 5 MB .xlsx file. Formulas and cached formula results are not imported."], ["Evidence", "The workbook is retained as the import source. Keep the supporting invoice/receipt evidence separately."], ["Review", "Upload, check the column matches and rows, then explicitly confirm the reviewed records. Duplicates are skipped without overwriting existing records."]];
  for (const row of instructions) { const added = guide.addRow(row); added.height = 45; added.alignment = { wrapText: true, vertical: "middle" }; }
  // These compact lists fit Excel's 255-character inline-validation limit.
  guide.getCell("D1").value = "Categories"; guide.getCell("E1").value = "GST treatments";
  categories.forEach((value, index) => { guide.getCell(index + 2, 4).value = value; }); treatments.forEach((value, index) => { guide.getCell(index + 2, 5).value = value; });
  guide.getColumn(4).width = 32; guide.getColumn(5).width = 30;
  for (let row = 2; row <= 1001; row++) {
    for (const [column, formula] of [[6, '"Expense,Income,Personal"'], [7, `"${categories.join(",")}"`], [8, `"${treatments.join(",")}"`], [10, '"Yes,No"'], [11, '"AUD"']] as const) sheet.getCell(row, column).dataValidation = { type: "list", allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: "Choose a supported value", error: "Choose a value from the list." };
  }
  for (const page of [sheet, guide]) { page.getRow(1).font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; page.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7240C4" } }; page.getRow(1).height = 34; }
  return workbook.xlsx.writeBuffer();
}
