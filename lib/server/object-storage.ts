import { S3Client, PutObjectCommand, GetObjectCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketVersioningCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { database } from "./database";
import { dataDirectory, production } from "./config";
import { VaultError } from "./errors";
import { scanFile } from "./scanner";
const maximum = 11 * 1024 * 1024;
const identifier = /^[0-9a-f-]{36}$/i;
function storageClient() {
  if (!process.env.INVOICEFLOW_S3_BUCKET || !process.env.INVOICEFLOW_S3_REGION) throw new VaultError("Private storage is not configured.", 503);
  // SDK credentials come from the provider chain, preferably an execution role.
  return new S3Client({ region: process.env.INVOICEFLOW_S3_REGION, maxAttempts: 2 });
}
const remote = () => production() || process.env.INVOICEFLOW_STORAGE === "s3";
export async function verifyPrivateBucket() {
  const client = storageClient(), Bucket = process.env.INVOICEFLOW_S3_BUCKET!;
  try {
    const [publicAccess, encryption, versioning] = await Promise.all([
      client.send(new GetPublicAccessBlockCommand({ Bucket })),
      client.send(new GetBucketEncryptionCommand({ Bucket })),
      client.send(new GetBucketVersioningCommand({ Bucket })),
    ]);
    const settings = publicAccess.PublicAccessBlockConfiguration;
    if (!settings || !settings.BlockPublicAcls || !settings.BlockPublicPolicy || !settings.IgnorePublicAcls || !settings.RestrictPublicBuckets || !encryption.ServerSideEncryptionConfiguration?.Rules?.length || versioning.Status !== "Enabled") throw new VaultError("The private bucket does not pass public-access, encryption and versioning checks.", 503);
    return { publicAccessBlocked: true, encryptionConfigured: true, versioningEnabled: true };
  } finally { client.destroy(); }
}
export async function storeOriginal(workspaceId: string, id: string, bytes: Buffer) {
  if (!identifier.test(workspaceId) || !identifier.test(id) || bytes.length > maximum) throw new VaultError("Invalid document storage request.", 413);
  const objectKey = `workspaces/${workspaceId}/originals/${id}`, hash = createHash("sha256").update(bytes).digest("hex");
  let versionId: string | null = null;
  if (remote()) {
    const client = storageClient();
    try {
      const result = await client.send(new PutObjectCommand({ Bucket: process.env.INVOICEFLOW_S3_BUCKET, Key: objectKey, Body: bytes, ContentType: "application/octet-stream", ServerSideEncryption: "AES256", ChecksumSHA256: Buffer.from(hash, "hex").toString("base64") }));
      if (!result.VersionId) throw new VaultError("Private storage versioning is required.", 503);
      versionId = result.VersionId;
    } finally { client.destroy(); }
  } else await writeFile(path.join(dataDirectory(), "documents", id), bytes, { flag: "wx", mode: 0o600 });
  let scanStatus: "local-validated" | "clean" | "blocked" = "blocked";
  let scanError: unknown;
  try { scanStatus = await scanFile(bytes); } catch (error) { scanError = error; }
  await (await database()).query("INSERT INTO stored_object(id,workspace_id,object_key,version_id,sha256,size,scan_status) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, workspaceId, objectKey, versionId, hash, bytes.length, scanStatus]);
  if (scanError) throw scanError;
}
export async function readOriginal(workspaceId: string, id: string) {
  const row = (await (await database()).query<{ object_key: string; version_id: string | null; sha256: string; size: string; scan_status: string }>("SELECT object_key,version_id,sha256,size,scan_status FROM stored_object WHERE workspace_id=$1 AND id=$2", [workspaceId, id])).rows[0];
  if (row?.scan_status === "blocked" || (production() && row?.scan_status !== "clean")) throw new VaultError("This original has not passed production scanning.", 403);
  if (!row && remote()) throw new VaultError("Migrate this local original before using production storage.", 503);
  if (!remote()) {
    const bytes = await readFile(path.join(dataDirectory(), "documents", id));
    if (row && (String(bytes.length) !== String(row.size) || createHash("sha256").update(bytes).digest("hex") !== row.sha256)) throw new VaultError("Original file integrity check failed.", 503);
    return bytes;
  }
  const client = storageClient();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: process.env.INVOICEFLOW_S3_BUCKET, Key: row.object_key, VersionId: row.version_id! }));
    const body = response.Body;
    if (!body) throw new VaultError("Original file is unavailable.", 404);
    try {
      const chunks: Uint8Array[] = []; let count = 0;
      for await (const chunk of body as AsyncIterable<Uint8Array>) { count += chunk.length; if (count > maximum) throw new VaultError("Original file exceeds the download limit.", 413); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (String(bytes.length) !== String(row.size) || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new VaultError("Original file integrity check failed.", 503);
      return bytes;
    } finally { if ("destroy" in body && typeof body.destroy === "function") body.destroy(); }
  } finally { client.destroy(); }
}
