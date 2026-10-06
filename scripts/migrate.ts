import { loadEnvConfig } from "@next/env";
import { openDatabase, migrate, migrations } from "../lib/server/database";
async function main() {
loadEnvConfig(process.cwd());
if (process.env.INVOICEFLOW_MIGRATION_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.INVOICEFLOW_MIGRATION_DATABASE_URL;
  process.env.INVOICEFLOW_DATABASE = "postgres";
}
const db = await openDatabase();
try {
  let versions: number[] = [];
  try { versions = (await db.query<{ version: number }>("SELECT version FROM schema_migration")).rows.map(row => row.version); }
  catch (error) { if ((error as { code?: string }).code !== "42P01") throw error; }
  const pending = migrations.filter(item => !versions.includes(item.version)).map(item => item.version);
  console.log(JSON.stringify({ database: db.kind, pendingVersions: pending, apply: process.argv.includes("--apply") }));
  if (process.argv.includes("--apply")) { await migrate(db); console.log("Reviewed database migrations applied."); }
} catch { console.error("Migration did not complete. Check connectivity, TLS and migration-role permissions privately."); process.exitCode = 1; }
finally { await db.close(); }

}
main().catch(() => { console.error("Operator check failed. Inspect configuration privately."); process.exitCode = 1; });

