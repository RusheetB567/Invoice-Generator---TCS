import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { VaultError } from "./vault";
import { matchColumns, type ImportSheet, type SheetCell } from "../domain/spreadsheet-records";
export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_EXPANDED = 25 * 1024 * 1024;
/** Bound actual decompression before ExcelJS reads the archive. No macros, links or DTDs. */
export function inspectXlsx(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_XLSX_BYTES) throw new VaultError("Choose an .xlsx file up to 5 MB.", 413);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new VaultError("Choose a standard, unencrypted .xlsx workbook.");
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), start = bytes.readUInt32LE(end + 16);
  if (!count || count > 250 || count !== bytes.readUInt16LE(end + 8) || start + size !== end) throw new VaultError("This workbook is too complex to import.");
  let offset = start, expanded = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new VaultError("The workbook archive is invalid.");
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), compressed = bytes.readUInt32LE(offset + 20), expected = bytes.readUInt32LE(offset + 24), nameLength = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    if (offset + 46 + nameLength + extra + comment > end || local + 30 > start || expected > MAX_EXPANDED || flags & 1 || ![0, 8].includes(method)) throw new VaultError("Unsupported or oversized workbook archive.");
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (names.has(name) || name.includes("..") || name.includes("\\") || name.startsWith("/") || /\0|vbaproject|externalLinks|embeddings/i.test(name)) throw new VaultError("Use a workbook without macros, embedded files or external links.");
    names.add(name);
    if (bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags) throw new VaultError("The workbook archive is inconsistent.");
    const localNameLength = bytes.readUInt16LE(local + 26), dataStart = local + 30 + localNameLength + bytes.readUInt16LE(local + 28);
    if (dataStart + compressed > start || bytes.subarray(local + 30, local + 30 + localNameLength).toString("utf8") !== name) throw new VaultError("The workbook archive is invalid.");
    let content: Buffer;
    try { content = method === 0 ? bytes.subarray(dataStart, dataStart + compressed) : inflateRawSync(bytes.subarray(dataStart, dataStart + compressed), { maxOutputLength: MAX_EXPANDED - expanded }); }
    catch { throw new VaultError("The workbook could not be safely expanded."); }
    expanded += content.length;
    if (content.length !== expected || expanded > MAX_EXPANDED) throw new VaultError("Expanded workbook data must stay under 25 MB.", 413);
    if (/\.(xml|rels)$/i.test(name)) {
      const xml = content.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new VaultError("Unsupported workbook XML.");
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
        for (const attribute of xml.matchAll(/\s(?:r|ref|sqref)=["']([^"']+)["']/g)) {
          for (const match of attribute[1].matchAll(/([A-Z]*)\$?(\d+)/g)) {
            const column = [...match[1]].reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0);
            if (Number(match[2]) > 1010 || column > 40) throw new VaultError("Import up to 1,000 data rows and 40 columns per sheet.", 413);
          }
        }
      }
    }
    offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) throw new VaultError("Choose a valid .xlsx workbook.");
}
function readCell(cell: ExcelJS.Cell): SheetCell {
  const value = cell.value;
  if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) return { value: "", formula: true };
  if (value instanceof Date) return { value: Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10) };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { value: "", formula: true };
    const zeroFormat = cell.numFmt?.match(/^0{2,20}$/);
    return { value: zeroFormat && Number.isInteger(value) ? String(value).padStart(zeroFormat[0].length, "0") : String(value), percentage: cell.numFmt?.replace(/"[^"]*"|\\./g, "").includes("%") };
  }
  const text = typeof value === "object" && value && "richText" in value ? value.richText.map(part => part.text).join("") : typeof value === "object" && value && "text" in value ? String(value.text) : String(value ?? "");
  if (text.length > 5000) throw new VaultError("A workbook cell exceeds the 5,000-character limit.");
  return { value: text };
}
export async function readXlsx(bytes: Buffer): Promise<ImportSheet[]> {
  inspectXlsx(bytes);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); } catch { throw new VaultError("The workbook could not be read. Save it as a standard .xlsx file."); }
  if (workbook.worksheets.length > 10) throw new VaultError("Use a workbook with up to 10 sheets.");
  const sheets: ImportSheet[] = [];
  for (const sheet of workbook.worksheets) {
    if (!sheet.actualRowCount) continue;
    if (sheet.columnCount > 40 || sheet.rowCount > 1010) throw new VaultError("Import up to 1,000 rows and 40 columns per sheet.", 413);
    let headerRow = 1, best = 0;
    for (let row = 1; row <= Math.min(10, sheet.rowCount); row++) {
      const headers = Array.from({ length: sheet.columnCount }, (_, index) => readCell(sheet.getCell(row, index + 1)).value);
      const mapping = matchColumns(headers), score = Object.values(mapping).filter(value => value !== null).length;
      if (score > best) { best = score; headerRow = row; }
    }
    // Overview/guide sheets are not invoice data. Custom headers still work via manual mapping.
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => readCell(sheet.getCell(headerRow, index + 1)).value || `Column ${index + 1}`);
    const mapping = matchColumns(headers);
    if (["overview", "tax summary", "guide"].includes(sheet.name.toLowerCase()) && ![mapping.supplier, mapping.number, mapping.issued, mapping.total, mapping.gst].every(column => column !== null)) continue;
    const rows: ImportSheet["rows"] = [];
    sheet.eachRow((row, number) => { if (number <= headerRow) return; const cells = headers.map((_, index) => readCell(row.getCell(index + 1))); if (cells.some(cell => cell.value || cell.formula)) rows.push({ number, cells }); });
    if (rows.length > 1000) throw new VaultError("Import up to 1,000 records per sheet.", 413);
    if (rows.length) sheets.push({ name: sheet.name, headers, rows });
  }
  if (!sheets.length) throw new VaultError("No invoice rows were found. Add records under the template's headers.");
  if (JSON.stringify(sheets).length > 2000000) throw new VaultError("The workbook contains too much text. Import a smaller batch.", 413);
  return sheets;
}
