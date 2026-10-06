import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { accountMigration } from "./account-migration";
import { backendMigration } from "./backend-migration";
import { securityMigration } from "./security-migration";
import { dataDirectory, production, postgresOptions } from "./config";
import { VaultError } from "./errors";

export interface SqlConnection {
  query<Row = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: Row[] }>;
  exec(sql: string): Promise<unknown>;
}
export interface AppDatabase extends SqlConnection {
  kind: "local" | "postgres";
  native: PGlite | Pool;
  transaction<T>(callback: (tx: SqlConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export const migrations = [
  { version: 1, sql: `CREATE TABLE IF NOT EXISTS vault_documents (id UUID PRIMARY KEY, hash TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());\n${accountMigration}` },
  { version: 2, sql: backendMigration },
  { version: 3, sql: securityMigration },
];
export async function migrate(db: AppDatabase) {
  await db.transaction(async tx => {
    // One connection holds the lock and applies all DDL atomically.
    await tx.exec("CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()); LOCK TABLE schema_migration IN EXCLUSIVE MODE;");
    const done = new Set((await tx.query<{ version: number }>("SELECT version FROM schema_migration")).rows.map(row => row.version));
    for (const migration of migrations) if (!done.has(migration.version)) {
      await tx.exec(migration.sql);
      await tx.query("INSERT INTO schema_migration(version) VALUES($1)", [migration.version]);
    }
  });
}
function sqlConnection(connection: Pool | PoolClient): SqlConnection {
  return { query: async <Row>(sql: string, parameters?: unknown[]) => ({ rows: (await connection.query(sql, parameters)).rows as Row[] }), exec: sql => connection.query(sql) };
}
export async function openDatabase(): Promise<AppDatabase> {
  if (production() || process.env.INVOICEFLOW_DATABASE === "postgres") {
    const pool = new Pool(postgresOptions());
    pool.on("error", () => console.error("InvoiceFlow database connection failed"));
    return { ...sqlConnection(pool), kind: "postgres", native: pool, close: () => pool.end(), transaction: async callback => {
      const connection = await pool.connect();
      try { await connection.query("BEGIN"); const value = await callback(sqlConnection(connection)); await connection.query("COMMIT"); return value; }
      catch (error) { await connection.query("ROLLBACK"); throw error; }
      finally { connection.release(); }
    } };
  }
  await mkdir(path.join(dataDirectory(), "documents"), { recursive: true });
  // Reuse the previous local connection during a development hot reload;
  // two PGlite handles must never open the same persisted directory.
  const legacy = (globalThis as unknown as { tcsVaults?: Map<string, Promise<PGlite>> }).tcsVaults?.get(dataDirectory());
  const native = legacy ? await legacy : new PGlite(path.join(dataDirectory(), "postgres"));
  return { kind: "local", native, query: (sql, parameters) => native.query(sql, parameters), exec: sql => native.exec(sql), transaction: callback => native.transaction(tx => callback(tx)), close: () => native.close() };
}
const state = globalThis as unknown as { invoiceDatabases?: Map<string, Promise<AppDatabase>> };
export function database() {
  state.invoiceDatabases ??= new Map();
  const key = production() || process.env.INVOICEFLOW_DATABASE === "postgres" ? `postgres:${process.env.DATABASE_URL}` : dataDirectory();
  if (!state.invoiceDatabases.has(key)) {
    const opening = (async () => {
      const db = await openDatabase();
      try {
        if (db.kind === "local") await migrate(db);
        else {
          const row = (await db.query<{ version: number }>("SELECT MAX(version)::int AS version FROM schema_migration")).rows[0];
          if (row?.version !== migrations.at(-1)?.version) throw new VaultError("Apply the reviewed database migrations before starting this application.", 503);
        }
        return db;
      } catch (error) { await db.close(); throw error; }
    })();
    state.invoiceDatabases.set(key, opening);
    opening.catch(() => state.invoiceDatabases?.delete(key));
  }
  return state.invoiceDatabases.get(key)!;
}
