import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateInvoice, getInvoice } from "./invoices";
import { database } from "./database";
import { audit } from "./audit";
import { storeOriginal, readOriginal } from "./object-storage";
import { VaultError } from "./errors";
import type { Draft } from "../local-data";
import { hundredths, lineTotal } from "../domain/invoice-math";

const fonts = () => Promise.all([readFile(path.join(process.cwd(), "app/fonts/pdf/NotoSans-Regular.ttf")), readFile(path.join(process.cwd(), "app/fonts/pdf/NotoSans-Bold.ttf"))]);
function amount(cents: string, currency: string) { const value = BigInt(cents); return `${currency} ${(value / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(value % BigInt(100)).toString().padStart(2, "0")}`; }
function lines(text: string, font: PDFFont, size: number, width: number) {
  const output: string[] = [], charset = new Set(font.getCharacterSet());
  const clean = text.replace(/\r\n/g, "\n").replace(/\t/g, "    ");
  if ([...clean].some(character => character !== "\n" && !charset.has(character.codePointAt(0)!))) throw new VaultError("This PDF font cannot display a character in your invoice. Replace that character or configure an additional font.", 422);
  for (const paragraph of clean.split("\n")) {
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(line + token, size) > width && line.trim()) { output.push(line.trimEnd()); line = ""; }
      if (!line && !token.trim()) continue;
      if (font.widthOfTextAtSize(token, size) > width) {
        for (const character of token) {
          if (font.widthOfTextAtSize(line + character, size) > width && line) { output.push(line); line = ""; }
          line += character;
        }
      } else line += token;
    }
    output.push(line);
  }
  return output;
}
export async function renderInvoicePdf(raw: Draft) {
  const draft = validateInvoice(raw), pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await fonts();
  const [regular, bold] = await Promise.all([pdf.embedFont(regularBytes, { subset: true }), pdf.embedFont(boldBytes, { subset: true })]);
  const hex = draft.form.brand.slice(1), accent = rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const ink = rgb(0.12, 0.14, 0.19), muted = rgb(0.38, 0.42, 0.48);
  let page = pdf.addPage([595.28, 841.89]), y = 785;
  const newPage = () => {
    if (pdf.getPageCount() >= 30) throw new VaultError("This invoice exceeds the 30-page PDF limit. Shorten the billing descriptions.", 422);
    page = pdf.addPage([595.28, 841.89]); y = 780;
    page.drawText(`INVOICE ${draft.number} - continued`, { x: 48, y, size: 10, font: bold, color: muted }); y -= 30;
  };
  const text = (value: string, size = 10, weight = false, color = ink, width = 499) => {
    for (const line of lines(value, weight ? bold : regular, size, width)) {
      if (y < 65 + size) newPage();
      page.drawText(line, { x: 48, y, size, font: weight ? bold : regular, color }); y -= size * 1.55;
    }
  };
  const gap = (value = 14) => { y -= value; };
  const rule = () => { if (y < 90) newPage(); page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: accent }); y -= 20; };
  if (draft.logo) {
    try {
      const bytes = Buffer.from(draft.logo.split(",")[1], "base64"), image = draft.logo.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      if (image.width > 8192 || image.height > 8192 || image.width * image.height > 20000000) throw new Error();
      const scale = Math.min(100 / image.width, 55 / image.height);
      page.drawImage(image, { x: 447, y: 735, width: image.width * scale, height: image.height * scale });
    } catch { throw new VaultError("Use a valid PNG or JPG logo up to 20 megapixels.", 422); }
  }
  text(draft.company, 20, true, ink, 380); text(draft.form.tagline, 10, false, muted, 380);
  text(draft.form.companyAddress, 10, false, muted, 380); text(draft.form.businessIdentifier, 10, false, muted, 380); gap(); rule();
  text(`INVOICE ${draft.number}`, 18, true, accent); text(`Issued ${draft.issued}   |   Due ${draft.due}   |   ${draft.currency}`, 10, false, muted); gap();
  text("BILL TO", 9, true, muted); text(draft.customer, 13, true); text(draft.form.customerAddress); if (draft.form.location) text(draft.form.location); gap(20); rule();
  if (draft.format === "sections") for (const section of draft.sections!) {
    if (y < 150) newPage();
    text(section.heading, 12, true); if (section.details) text(section.details, 10, false, muted); gap(6);
    const cents = section.amount.split("."); const value = (BigInt(cents[0]) * BigInt(100) + BigInt((cents[1] || "").padEnd(2, "0"))).toString();
    text(amount(value, draft.currency), 11, true, accent); gap(18);
  } else {
    const tableHeader = () => {
      if (y < 130) newPage();
      page.drawRectangle({ x: 48, y: y - 8, width: 499, height: 25, color: rgb(0.95, 0.94, 0.98) });
      for (const [value, x] of [["SERVICE", 54], [(draft.form.lineLabel || "QTY").slice(0, 9), 349], ["RATE", 409], ["AMOUNT", 482]] as const) page.drawText(value, { x, y, font: bold, size: 8, color: ink });
      y -= 30;
    };
    tableHeader();
    for (const row of draft.items) {
      const body = [...lines(row.description, bold, 10, 280).map(value => ({ value, heading: true })), ...lines(row.details, regular, 9, 280).map(value => ({ value, heading: false }))];
      if (y < 130) { newPage(); tableHeader(); }
      const total = lineTotal(hundredths(row.quantity, BigInt(99999))!, hundredths(row.rate, BigInt(9999999))!).toString();
      for (const [value, right] of [[row.quantity, 396], [row.rate, 456], [amount(total, "").trim(), 541]] as const) page.drawText(value, { x: right - regular.widthOfTextAtSize(value, 9), y, font: regular, size: 9, color: ink });
      for (const line of body) {
        if (y < 85) { newPage(); tableHeader(); }
        page.drawText(line.value, { x: 54, y, font: line.heading ? bold : regular, size: line.heading ? 10 : 9, color: line.heading ? ink : muted }); y -= 15;
      }
      gap(10); page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.4, color: rgb(0.86, 0.86, 0.89) }); gap(20);
    }
  }
  if (y < 200) newPage();
  rule();
  text(`Subtotal   ${amount(draft.subtotalCents, draft.currency)}`, 11);
  text(`${draft.form.taxLabel} (${draft.form.tax}%)   ${amount(draft.taxCents, draft.currency)}`, 11);
  gap(8);
  text(`TOTAL   ${amount(draft.totalCents, draft.currency)}`, 18, true, accent); gap(20);
  if (draft.form.payment) { text("PAYMENT DETAILS", 9, true, muted); text(draft.form.payment); gap(); }
  if (draft.form.notes) { text("NOTES", 9, true, muted); text(draft.form.notes, 10, false, muted); }
  for (const [index, sheet] of pdf.getPages().entries()) {
    sheet.drawLine({ start: { x: 48, y: 48 }, end: { x: 547, y: 48 }, thickness: 0.5, color: rgb(0.85, 0.86, 0.89) });
    sheet.drawText(`${draft.number} | Revision ${draft.revision ?? 1} | Page ${index + 1} of ${pdf.getPageCount()}`, { x: 48, y: 31, size: 8, font: regular, color: muted });
  }
  pdf.setTitle(`Invoice ${draft.number}`); pdf.setAuthor(draft.company); pdf.setProducer("TCS InvoiceFlow");
  return Buffer.from(await pdf.save());
}
export async function savedInvoicePdf(workspaceId: string, actorId: string, id: string) {
  const { payload: invoice } = await getInvoice(workspaceId, id), db = await database();
  const old = (await db.query<{ id: string }>("SELECT id FROM generated_pdf WHERE workspace_id=$1 AND invoice_id=$2 AND revision=$3", [workspaceId, id, invoice.revision])).rows[0];
  if (old) { const bytes = await readOriginal(workspaceId, old.id); await audit(db, workspaceId, actorId, "invoice.pdf.download", id, { revision: invoice.revision! }); return { bytes, invoice }; }
  const bytes = await renderInvoicePdf(invoice), objectId = randomUUID(); await storeOriginal(workspaceId, objectId, bytes);
  await db.transaction(async tx => {
    const saved = await tx.query("INSERT INTO generated_pdf(id,workspace_id,invoice_id,revision) VALUES($1,$2,$3,$4) ON CONFLICT(invoice_id,revision) DO NOTHING RETURNING id", [objectId, workspaceId, id, invoice.revision]);
    if (saved.rows.length) await audit(tx, workspaceId, actorId, "invoice.pdf.generate", id, { revision: invoice.revision! });
  });
  // On a concurrent generation, serve the canonical stored version.
  const canonical = (await db.query<{ id: string }>("SELECT id FROM generated_pdf WHERE workspace_id=$1 AND invoice_id=$2 AND revision=$3", [workspaceId, id, invoice.revision])).rows[0];
  const output = canonical.id === objectId ? bytes : await readOriginal(workspaceId, canonical.id);
  await audit(db, workspaceId, actorId, "invoice.pdf.download", id, { revision: invoice.revision! });
  return { bytes: output, invoice };
}
