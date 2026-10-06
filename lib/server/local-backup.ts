import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { AppDatabase } from "./database";
import { VaultError } from "./errors";
const magic = Buffer.from("TCSBKP01");
function key(value: string) { if (!/^[0-9a-f]{64}$/i.test(value)) throw new VaultError("Use a private 32-byte backup encryption key encoded as hexadecimal."); return Buffer.from(value, "hex"); }
/** Operator-only local tool. Stop the application before opening its persisted database here. */
export async function encryptedLocalBackup(db: AppDatabase, directory: string, privateKey: string) {
  if (db.kind !== "local") throw new VaultError("Use the hosting provider's database backup and recovery service for PostgreSQL.");
  const files: Record<string, string> = {};
  let size = 0;
  for (const entry of await readdir(path.join(directory, "documents"), { withFileTypes: true })) {
    if (!entry.isFile() || !/^[0-9a-f-]{36}$/i.test(entry.name)) throw new VaultError("Review unexpected files before creating a local backup.");
    const bytes = await readFile(path.join(directory, "documents", entry.name)); size += bytes.length;
    if (size > 512 * 1024 * 1024) throw new VaultError("This local backup exceeds the 512 MB limit. Use a streaming production backup service.");
    files[entry.name] = bytes.toString("base64");
  }
  let authSecret: string | null = null;
  try { authSecret = await readFile(path.join(directory, "auth-secret"), "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const snapshot = Buffer.from(await (await (db.native as PGlite).dumpDataDir("gzip")).arrayBuffer());
  const plaintext = Buffer.from(JSON.stringify({ version: 1, database: snapshot.toString("base64"), files, authSecret }));
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(privateKey), iv); cipher.setAAD(magic);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}
export async function restoreLocalBackup(bytes: Buffer, target: string, privateKey: string) {
  if (bytes.length < 37 || !bytes.subarray(0, 8).equals(magic)) throw new VaultError("Unsupported backup file.");
  let data: { version: number; database: string; files: Record<string, string>; authSecret: string | null };
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(privateKey), bytes.subarray(8, 20)); decipher.setAAD(magic); decipher.setAuthTag(bytes.subarray(20, 36));
    data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]).toString("utf8"));
    if (data.version !== 1 || typeof data.database !== "string" || !data.files || Object.keys(data.files).some(name => !/^[0-9a-f-]{36}$/i.test(name))) throw new Error();
  } catch { throw new VaultError("Backup integrity or encryption-key verification failed."); }
  // mkdir without recursive refuses an existing destination. Never replace live records.
  await mkdir(target);
  await mkdir(path.join(target, "documents"));
  for (const [name, value] of Object.entries(data.files)) await writeFile(path.join(target, "documents", name), Buffer.from(value, "base64"), { flag: "wx", mode: 0o600 });
  if (data.authSecret) await writeFile(path.join(target, "auth-secret"), data.authSecret, { flag: "wx", mode: 0o600 });
  return new PGlite({ dataDir: path.join(target, "postgres"), loadDataDir: new Blob([new Uint8Array(Buffer.from(data.database, "base64"))]) });
}
