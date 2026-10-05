import { PGlite } from "@electric-sql/pglite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { VaultDocument, TaxRecordInput } from "../domain/tax-record";

export class VaultError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function localOnly(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new VaultError("The local records vault is available on localhost in development. Shared hosting requires authentication and a managed database.", 503);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) throw new VaultError("This request is not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new VaultError("This request is not allowed.", 403);
  if (request.method !== "GET" && request.headers.get("x-invoiceflow-vault") !== "local") throw new VaultError("This request is not allowed.", 403);
}
const root = () => path.resolve(process.env.INVOICEFLOW_DATA_DIR || path.join(process.cwd(), "storage", "tax-vault"));
const state = globalThis as unknown as { tcsVaults?: Map<string, Promise<PGlite>> };
export async function database() {
  const directory = root();
  state.tcsVaults ??= new Map();
  if (!state.tcsVaults.has(directory)) {
    const opening = (async () => {
      await mkdir(path.join(directory, "documents"), { recursive: true });
      const db = new PGlite(path.join(directory, "postgres"));
      await db.exec(`CREATE TABLE IF NOT EXISTS vault_documents (
        id UUID PRIMARY KEY, hash TEXT NOT NULL UNIQUE, filename TEXT NOT NULL,
        payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
      return db;
    })();
    state.tcsVaults.set(directory, opening);
    opening.catch(() => state.tcsVaults?.delete(directory));
  }
  return state.tcsVaults.get(directory)!;
}
export async function listDocuments(): Promise<VaultDocument[]> {
  const result = await (await database()).query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents ORDER BY created_at DESC");
  // Inbox/summary views do not need every document's potentially large raw text.
  return result.rows.map(row => ({ ...row.payload, text: "" }));
}
export async function getDocument(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new VaultError("Document not found.", 404);
  const result = await (await database()).query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents WHERE id=$1", [id]);
  if (!result.rows[0]) throw new VaultError("Document not found.", 404);
  return result.rows[0].payload;
}
export async function originalFile(id: string) {
  await getDocument(id);
  return readFile(path.join(root(), "documents", id));
}
export async function storeDocument(bytes: Buffer, value: Omit<VaultDocument, "id" | "hash" | "createdAt">) {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const db = await database();
  const existing = await db.query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents WHERE hash=$1", [hash]);
  if (existing.rows[0]) return { document: existing.rows[0].payload, duplicate: true };
  const id = randomUUID();
  const document: VaultDocument = { ...value, id, hash, createdAt: new Date().toISOString() };
  await writeFile(path.join(root(), "documents", id), bytes, { flag: "wx" });
  const inserted = await db.query<{ payload: VaultDocument }>("INSERT INTO vault_documents(id,hash,filename,payload) VALUES($1,$2,$3,$4) ON CONFLICT(hash) DO NOTHING RETURNING payload", [id, hash, value.name, JSON.stringify(document)]);
  if (!inserted.rows.length) {
    // Leave any orphaned original for a future safe retention pass; never delete evidence automatically.
    const winner = await db.query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents WHERE hash=$1", [hash]);
    return { document: winner.rows[0].payload, duplicate: true };
  }
  return { document, duplicate: false };
}
export async function confirmDocument(id: string, record: TaxRecordInput) {
  const db = await database();
  return db.transaction(async tx => {
    const current = await tx.query<{ payload: VaultDocument }>("SELECT payload FROM vault_documents WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new VaultError("Document not found.", 404);
    if (current.rows[0].payload.status === "Confirmed") throw new VaultError("This record is already confirmed. Reload to see the saved version.", 409);
    const document = { ...current.rows[0].payload, status: "Confirmed" as const, record };
    await tx.query("UPDATE vault_documents SET payload=$2 WHERE id=$1", [id, JSON.stringify(document)]);
    return document;
  });
}
export function safeError(error: unknown) {
  if (error instanceof VaultError) return Response.json({ error: error.message }, { status: error.status });
  console.error("InvoiceFlow vault operation failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The records vault could not complete this operation. Your existing records have been kept." }, { status: 500 });
}
