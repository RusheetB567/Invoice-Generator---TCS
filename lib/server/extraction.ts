import path from "node:path";
import { createWorker } from "tesseract.js";
import { suggestFields } from "../domain/tax-record";
import { VaultError } from "./vault";

export function validateFile(bytes: Buffer, name: string, declaredType: string) {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new VaultError("Choose a document between 1 byte and 10 MB.");
  const extension = path.extname(name).toLowerCase();
  const mime = bytes.subarray(0, 5).toString() === "%PDF-" ? "application/pdf"
    : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg" : "";
  const expected = extension === ".pdf" ? "application/pdf" : extension === ".png" ? "image/png" : [".jpg", ".jpeg"].includes(extension) ? "image/jpeg" : "";
  if (!mime || expected !== mime || (declaredType && mime !== declaredType)) throw new VaultError("The file content, extension and type must match PDF, JPG or PNG.");
  let width = 0, height = 0;
  if (mime === "image/png") {
    if (bytes.length < 24) throw new VaultError("The PNG is incomplete.");
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1];
      if (marker === 218 || marker === 217) break;
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) { height = bytes.readUInt16BE(offset + 5); width = bytes.readUInt16BE(offset + 7); break; }
      offset += length + 2;
    }
  }
  if (mime !== "application/pdf" && (!width || !height || width > 8192 || height > 8192 || width * height > 20000000)) throw new VaultError("Use a readable image up to 20 megapixels and 8,192 pixels per side.");
  return mime;
}

async function ocr(images: Buffer[]) {
  const langPath = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int");
  const worker = await createWorker("eng", 1, { langPath, cacheMethod: "none" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => { const output = []; for (const image of images) output.push((await worker.recognize(image)).data.text); return output.join("\n\n"); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("OCRTimeout")), 90000); }),
    ]);
  } finally { clearTimeout(timer); await worker.terminate(); }
}

let processing = false;
export async function extract(bytes: Buffer, mime: string) {
  if (processing) throw new VaultError("Another document is being read. Please try again when it finishes.", 409);
  processing = true;
  let text = "", method: "PDF text" | "Local OCR" | "Manual review" = "Manual review", notice = "", pages = 1;
  try {
    if (mime === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes, isEvalSupported: false });
      try {
        const info = await parser.getInfo({ parsePageInfo: true });
        pages = info.total;
        if (info.total > 20) throw new VaultError("Split this PDF into documents of up to 20 pages.");
        if (info.pages.some(page => !page.width || !page.height || page.width > 20000 || page.height > 20000 || page.height / page.width > 8 || page.width / page.height > 8)) throw new VaultError("This PDF has unsupported page dimensions. Export it as standard-sized pages.");
        text = (await parser.getText()).text;
        method = "PDF text";
        if (text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim().length < 35) {
          if (info.total > 5) { text = ""; notice = "This scan needs manual review. Automatic scanned-PDF OCR supports up to 5 pages."; method = "Manual review"; }
          else { const pages = await parser.getScreenshot({ desiredWidth: 1600 }); text = await ocr(pages.pages.map(page => Buffer.from(page.data))); method = "Local OCR"; }
        }
      } finally { await parser.destroy(); }
    } else { text = await ocr([bytes]); method = "Local OCR"; }
  } catch (error) {
    if (error instanceof VaultError) throw error;
    if (error instanceof Error && error.name === "InvalidPDFException") throw new VaultError("This PDF appears incomplete or invalid. Export a fresh copy and try again.");
    text = ""; method = "Manual review"; notice = "Automatic reading was unavailable. The original is preserved; enter and confirm the details manually.";
  } finally { processing = false; }
  text = text.slice(0, 100000);
  return { text, method, notice, pages, candidate: suggestFields(text) };
}
