import { z } from "zod";
import { hundredths } from "./invoice-math";

export const categories = ["Sales & services", "Software & subscriptions", "Office & supplies", "Travel", "Vehicle", "Contractors", "Equipment / capital asset", "Other"] as const;
export const treatments = ["GST included", "GST-free", "Input taxed", "No GST / not registered", "Needs tax review"] as const;
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function financialYear(date: string) {
  if (!validDate(date)) return "Unassigned";
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);
  return `${year}–${year + 1}`;
}
const amount = z.string().refine(value => hundredths(value, BigInt(9999999)) !== null, "Enter a nonnegative amount with at most two decimals.");
export const taxRecordSchema = z.object({
  supplier: z.string().trim().min(1).max(300), number: z.string().trim().min(1).max(100),
  issued: z.string().refine(validDate, "Enter a valid invoice date."),
  kind: z.enum(["Expense", "Income", "Personal"]), category: z.enum(categories),
  treatment: z.enum(treatments), total: amount, gst: amount,
  businessPercent: z.string().refine(value => hundredths(value, BigInt(100)) !== null, "Business use must be 0–100%."),
  gstRegistered: z.boolean(), claimGst: z.boolean(),
  notes: z.string().max(5000), confirmed: z.literal(true), currency: z.literal("AUD"),
}).superRefine((value, context) => {
  const total = hundredths(value.total, BigInt(9999999))!;
  const gst = hundredths(value.gst, BigInt(9999999))!;
  if (gst > total) context.addIssue({ code: "custom", path: ["gst"], message: "GST cannot exceed the total." });
  if (!["GST included", "Needs tax review"].includes(value.treatment) && gst > BigInt(0)) context.addIssue({ code: "custom", path: ["gst"], message: "This tax treatment requires zero GST." });
  if (value.claimGst && (!value.gstRegistered || value.kind !== "Expense" || value.treatment !== "GST included")) context.addIssue({ code: "custom", path: ["claimGst"], message: "GST credit estimate requires a GST-registered business expense with GST included." });
  if (value.kind === "Personal" && hundredths(value.businessPercent, BigInt(100)) !== BigInt(0)) context.addIssue({ code: "custom", path: ["businessPercent"], message: "Personal records must have zero business use." });
});
export type TaxRecordInput = z.infer<typeof taxRecordSchema>;
export type Candidate = { supplier: string; number: string; issued: string; total: string; gst: string };
export type VaultDocument = {
  id: string; name: string; mime: string; hash: string; status: "Review" | "Confirmed";
  method: "PDF text" | "Local OCR" | "Manual review"; text: string; candidate: Candidate;
  notice: string; createdAt: string; record: TaxRecordInput | null; pages?: number;
};
export function allocations(record: TaxRecordInput) {
  const total = hundredths(record.total, BigInt(9999999))!;
  const gst = hundredths(record.gst, BigInt(9999999))!;
  const percent = record.kind === "Personal" ? BigInt(0) : hundredths(record.businessPercent, BigInt(100))!;
  const allocated = (total * percent + BigInt(5000)) / BigInt(10000);
  const credit = record.claimGst ? (gst * percent + BigInt(5000)) / BigInt(10000) : BigInt(0);
  return { allocated, credit, costExCredit: allocated - credit };
}

/** Conservative field suggestions, never an authoritative financial record. */
export function suggestFields(text: string): Candidate {
  const money = (label: string) => {
    const match = text.match(new RegExp(`(?:${label})\\s*[:]?\\s*(?:AUD|A?\\$)?\\s*([0-9][0-9,]*\\.[0-9]{2})`, "i"));
    return match?.[1].replaceAll(",", "") ?? "";
  };
  const dateLabel = text.match(/(?:invoice date|date issued|(?<!due )\bissued|(?<!due )\bdate)\s*:/i);
  const dateArea = dateLabel?.index !== undefined ? text.slice(dateLabel.index + dateLabel[0].length, dateLabel.index + dateLabel[0].length + 150) : "";
  const date = dateArea.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i)?.[0] ?? "";
  const parts = date.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const named = date.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const iso = parts ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}` : named ? `${named[3]}-${String(months.indexOf(named[2].toLowerCase()) + 1).padStart(2,"0")}-${named[1].padStart(2,"0")}` : date;
  const invoiceLabel = text.match(/invoice\s*(?:number|no\.?|#)\s*:/i) ?? text.match(/invoice\s*(?:number|no\.?|#)\s+/i);
  const numberArea = invoiceLabel?.index !== undefined ? text.slice(invoiceLabel.index + invoiceLabel[0].length).split(/\n/).slice(0,5) : [];
  const number = numberArea.map(line => line.trim()).find(line => /^[A-Z0-9/-]{1,60}$/i.test(line) && /\d/.test(line)) ?? "";
  return {
    supplier: text.split(/\n/).map(line => line.trim()).find(line => line.length > 2 && line.length < 100 && !/^(tax\s+)?invoice\b|^page\b|^--/i.test(line)) ?? "",
    number,
    issued: validDate(iso) ? iso : "", total: money("grand total|total due|invoice total|total amount|(?<!sub)total"), gst: money("total GST|GST|tax amount"),
  };
}
