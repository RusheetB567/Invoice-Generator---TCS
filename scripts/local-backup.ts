import { loadEnvConfig } from "@next/env";
import { writeFile, readFile } from "node:fs/promises";
import { openDatabase, migrate } from "../lib/server/database";
import { dataDirectory } from "../lib/server/config";
import { encryptedLocalBackup, restoreLocalBackup } from "../lib/server/local-backup";
async function main() {
  loadEnvConfig(process.cwd());
  const [mode, filename, target] = process.argv.slice(2);
  if (!process.env.INVOICEFLOW_BACKUP_KEY || process.env.INVOICEFLOW_OPERATOR_APP_STOPPED !== "true" || !filename || !["create", "restore"].includes(mode)) throw new Error();
  if (mode === "restore") {
    if (!target) throw new Error();
    const restored = await restoreLocalBackup(await readFile(filename), target, process.env.INVOICEFLOW_BACKUP_KEY);
    await restored.waitReady; await restored.close(); console.log("Backup restored to a new directory. Verify before switching the installation.");
  } else {
    const db = await openDatabase();
    try { await migrate(db); await writeFile(filename, await encryptedLocalBackup(db, dataDirectory(), process.env.INVOICEFLOW_BACKUP_KEY), { flag: "wx", mode: 0o600 }); console.log("Encrypted local backup created. Keep the recovery key separately."); }
    finally { await db.close(); }
  }
}
main().catch(() => { console.error("Backup operation failed. Check the private recovery key, stopped-application acknowledgement and new destination paths. Existing records were not replaced."); process.exitCode = 1; });
