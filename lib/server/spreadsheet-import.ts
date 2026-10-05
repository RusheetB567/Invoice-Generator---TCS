import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { database, dataDirectory, VaultError } from "./vault";
import { readXlsx } from "./xlsx-reader";
import { recordKey, type SpreadsheetBatch } from "../domain/spreadsheet-records";
import { taxRecordSchema, type VaultDocument } from "../domain/tax-record";
async function importsDatabase() {
  const db = await database();
  await db.exec(`CREATE TABLE IF NOT EXISTS vault_spreadsheet_import (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), hash TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,hash));`);
  return db;
}
const uuid = z.string().uuid();
export async function listImports(workspaceId: string) {
  return (await (await importsDatabase()).query<{ id: string; name: string; total: number; saved: number }>(`SELECT id, payload->>'name' AS name, (SELECT COALESCE(SUM(jsonb_array_length(s->'rows')),0)::int FROM jsonb_array_elements(payload->'sheets') s) AS total, (SELECT COUNT(*)::int FROM jsonb_object_keys(payload->'committedRows')) AS saved FROM vault_spreadsheet_import WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20`, [workspaceId])).rows;
}
export async function getImport(workspaceId: string, id: string): Promise<SpreadsheetBatch> {
  if (!uuid.safeParse(id).success) throw new VaultError("Import not found.", 404);
  const result = await (await importsDatabase()).query<{ payload: SpreadsheetBatch }>("SELECT payload FROM vault_spreadsheet_import WHERE id=$1 AND workspace_id=$2", [id, workspaceId]);
  if (!result.rows[0]) throw new VaultError("Import not found.", 404);
  return result.rows[0].payload;
}
export async function createImport(workspaceId: string, bytes: Buffer, name: string) {
  if (!/\.xlsx$/i.test(name) || name.length > 180 || /[\x00-\x1f]/.test(name)) throw new VaultError("Choose a standard .xlsx file with a short filename.");
  const sheets = await readXlsx(bytes), hash = createHash("sha256").update(bytes).digest("hex"), db = await importsDatabase();
  const old = await db.query<{ payload: SpreadsheetBatch }>("SELECT payload FROM vault_spreadsheet_import WHERE workspace_id=$1 AND hash=$2", [workspaceId, hash]);
  if (old.rows[0]) return { batch: old.rows[0].payload, duplicate: true };
  const id = randomUUID(), batch: SpreadsheetBatch = { id, name, hash, createdAt: new Date().toISOString(), sheets, committedRows: {} };
  await writeFile(path.join(dataDirectory(), "documents", id), bytes, { flag: "wx" });
  const saved = await db.query<{ payload: SpreadsheetBatch }>("INSERT INTO vault_spreadsheet_import(id,workspace_id,hash,payload) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,hash) DO NOTHING RETURNING payload", [id, workspaceId, hash, JSON.stringify(batch)]);
  if (!saved.rows[0]) return { batch: (await db.query<{ payload: SpreadsheetBatch }>("SELECT payload FROM vault_spreadsheet_import WHERE workspace_id=$1 AND hash=$2", [workspaceId, hash])).rows[0].payload, duplicate: true };
  return { batch, duplicate: false };
}
export const commitImportSchema = z.object({ sheet: z.string().min(1).max(100), reviewed: z.literal(true), rows: z.array(z.object({ number: z.number().int().min(2).max(1010), record: taxRecordSchema }).strict()).min(1).max(1000) }).strict();
export async function commitImport(workspaceId: string, id: string, raw: unknown) {
  const checked = commitImportSchema.safeParse(raw);
  if (!checked.success) throw new VaultError(checked.error.issues.slice(0, 5).map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" "), 422);
  await getImport(workspaceId, id);
  const input = checked.data, db = await importsDatabase();
  return db.transaction(async tx => {
    // Serialise separate workbook saves in the same workspace before checking identities.
    await tx.query("SELECT id FROM business_workspace WHERE id=$1 FOR UPDATE", [workspaceId]);
    const batch = (await tx.query<{ payload: SpreadsheetBatch }>("SELECT payload FROM vault_spreadsheet_import WHERE id=$1 AND workspace_id=$2 FOR UPDATE", [id, workspaceId])).rows[0]?.payload;
    if (!batch) throw new VaultError("Import not found.", 404);
    const sheet = batch.sheets.find(value => value.name === input.sheet);
    if (!sheet || new Set(input.rows.map(row => row.number)).size !== input.rows.length || input.rows.some(row => !sheet.rows.some(source => source.number === row.number))) throw new VaultError("Choose distinct rows from this workbook sheet.", 422);
    const existing = await tx.query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents WHERE workspace_id=$1 FOR UPDATE", [workspaceId]);
    const keys = new Map(existing.rows.flatMap(({ payload }) => payload.record ? [[recordKey(payload.record), payload.id] as const] : []));
    const outcome = { saved: 0, duplicates: 0, ids: [] as string[] };
    for (const row of input.rows) {
      const rowKey = `${sheet.name}:${row.number}`, key = recordKey(row.record), old = batch.committedRows[rowKey] || keys.get(key);
      if (old) { outcome.duplicates++; outcome.ids.push(old); batch.committedRows[rowKey] = old; continue; }
      const record = row.record, docId = randomUUID();
      const document: VaultDocument = { id: docId, name: batch.name, hash: createHash("sha256").update(`spreadsheet-record-v1:${key}`).digest("hex"), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", status: "Confirmed", method: "Excel import", text: JSON.stringify({ sheet: sheet.name, row: row.number, cells: sheet.headers.map((header, index) => [header, sheet.rows.find(source => source.number === row.number)!.cells[index]?.value ?? ""]) }, null, 2), candidate: { supplier: record.supplier, number: record.number, issued: record.issued, total: record.total, gst: record.gst }, notice: "Imported spreadsheet row. The original workbook is retained; attach the underlying invoice evidence separately when needed.", createdAt: new Date().toISOString(), record, source: { kind: "spreadsheet", batchId: id, sheet: sheet.name, row: row.number, fileHash: batch.hash } };
      await tx.query("INSERT INTO vault_documents(id,workspace_id,hash,filename,payload) VALUES($1,$2,$3,$4,$5)", [docId, workspaceId, document.hash, batch.name, JSON.stringify(document)]);
      keys.set(key, docId); batch.committedRows[rowKey] = docId; outcome.saved++; outcome.ids.push(docId);
    }
    await tx.query("UPDATE vault_spreadsheet_import SET payload=$1 WHERE id=$2 AND workspace_id=$3", [JSON.stringify(batch), id, workspaceId]);
    return { ...outcome, batch };
  });
}
