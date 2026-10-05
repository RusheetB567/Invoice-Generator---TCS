import { taxRecordSchema, validDate, type TaxRecordInput } from "./tax-record";
export const importFields = ["supplier", "number", "issued", "total", "gst", "kind", "category", "treatment", "businessPercent", "gstRegistered", "currency", "notes"] as const;
export type ImportField = typeof importFields[number];
export type ColumnMapping = Record<ImportField, number | null>;
export const fieldLabels: Record<ImportField, string> = { supplier: "Supplier / customer", number: "Invoice number", issued: "Invoice date", total: "Total including GST", gst: "GST on document", kind: "Record type", category: "Category", treatment: "GST treatment", businessPercent: "Business use %", gstRegistered: "GST registered", currency: "Currency", notes: "Notes" };
export type SheetCell = { value: string; formula?: boolean; percentage?: boolean };
export type ImportSheet = { name: string; headers: string[]; rows: { number: number; cells: SheetCell[] }[] };
export type RecordDraft = Omit<TaxRecordInput, "confirmed"> & { confirmed: boolean };
export type SpreadsheetBatch = { id: string; name: string; hash: string; createdAt: string; sheets: ImportSheet[]; committedRows: Record<string, string> };
const aliases: Record<ImportField, string[]> = { supplier: ["supplier customer", "supplier", "customer", "vendor", "company", "supplier name", "customer name"], number: ["invoice number", "invoice no", "invoice", "number", "invoice id"], issued: ["invoice date", "issued", "issue date", "date"], total: ["total", "total including gst", "total amount", "gross amount", "amount"], gst: ["gst on document", "gst", "gst amount", "tax amount"], kind: ["type", "record type", "kind"], category: ["category"], treatment: ["gst treatment", "tax treatment"], businessPercent: ["business use", "business use percent", "business use percentage", "business percent"], gstRegistered: ["gst registered"], currency: ["currency"], notes: ["notes", "description", "memo"] };
const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function matchColumns(headers: string[]): ColumnMapping {
  const result = {} as ColumnMapping;
  for (const field of importFields) {
    const matches = headers.map((header, index) => aliases[field].includes(normal(header)) ? index : -1).filter(index => index >= 0);
    result[field] = matches.length === 1 ? matches[0] : null;
  }
  return result;
}
export function recordKey(record: Pick<TaxRecordInput, "supplier" | "number" | "issued" | "kind" | "currency">) {
  return JSON.stringify([record.supplier.trim().toLowerCase(), record.number.trim().toLowerCase(), record.issued, record.kind, record.currency]);
}
function decimal(value: string) {
  const text = value.trim().replace(/^(?:AUD\s*|A?\$\s*)/i, "");
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return text.replaceAll(",", "");
  return text;
}
function date(value: string) {
  if (validDate(value)) return value;
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return parts ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}` : value;
}
export function draftFromRow(row: ImportSheet["rows"][number], mapping: ColumnMapping): RecordDraft {
  const cell = (field: ImportField) => mapping[field] === null ? undefined : row.cells[mapping[field]!];
  const value = (field: ImportField) => cell(field)?.formula ? "" : cell(field)?.value.trim() ?? "";
  const percent = cell("businessPercent");
  const businessPercent = percent?.percentage && !percent.formula ? String(Number(percent.value) * 100) : value("businessPercent").replace(/%$/, "");
  return { supplier: value("supplier"), number: value("number"), issued: date(value("issued")), total: decimal(value("total")), gst: decimal(value("gst")), kind: (value("kind") || "Expense") as RecordDraft["kind"], category: (value("category") || "Other") as RecordDraft["category"], treatment: (value("treatment") || "Needs tax review") as RecordDraft["treatment"], businessPercent: businessPercent || "0", gstRegistered: /^(yes|true)$/i.test(value("gstRegistered")), claimGst: false, currency: (value("currency") || "AUD") as "AUD", notes: value("notes"), confirmed: false };
}
export function draftIssues(record: RecordDraft): string[] {
  const result = taxRecordSchema.safeParse({ ...record, confirmed: true });
  return result.success ? [] : result.error.issues.map(issue => `${fieldLabels[issue.path[0] as ImportField] || String(issue.path[0])}: ${issue.message}`);
}
