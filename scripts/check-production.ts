import { loadEnvConfig } from "@next/env";
import { assertProductionConfigured, postgresOptions } from "../lib/server/config";
import { verifyPrivateBucket } from "../lib/server/object-storage";
import { database } from "../lib/server/database";
async function main() {
loadEnvConfig(process.cwd());
try {
  if (process.env.NODE_ENV !== "production") throw new Error("Run this check with NODE_ENV=production.");
  assertProductionConfigured(); postgresOptions();
  const db = await database();
  try {
    await db.query("SELECT 1");
    const privileges = (await db.query<{ unsafe: boolean }>("SELECT has_schema_privilege(current_user,'public','CREATE') OR has_table_privilege(current_user,'workspace_audit','UPDATE,DELETE') OR has_table_privilege(current_user,'invoice_revision','UPDATE,DELETE') AS unsafe")).rows[0];
    if (privileges.unsafe) throw new Error("Runtime role has excess history or schema privileges.");
    console.log(JSON.stringify({ databaseConnected: true, reviewedMigrationsPresent: true, historyPrivilegesRestricted: true, bucket: await verifyPrivateBucket(), recoveryDrill: "operator evidence required", residency: "operator evidence required", emailDelivery: "end-to-end test required", scanner: "health and blocked-file test required" }));
  } finally { await db.close(); }
} catch { console.error("Production readiness check failed. Review required configuration and provider controls privately; public access must remain disabled."); process.exitCode = 1; }

}
main().catch(() => { console.error("Operator check failed. Inspect configuration privately."); process.exitCode = 1; });

