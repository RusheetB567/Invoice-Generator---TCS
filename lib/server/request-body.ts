import { VaultError } from "./vault";
export async function boundedJson(
  request: Request,
  maximum: number,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new VaultError("Send valid JSON details.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new VaultError("Request details are missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > maximum) {
        await reader.cancel();
        throw new VaultError("Request details are too long.", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new VaultError("Send valid JSON details.");
  }
}
export async function boundedMultipart(request: Request, maximum: number) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;")) throw new VaultError("Choose a file to upload.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new VaultError("Upload data is missing.");
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      length += next.value.length;
      if (length > maximum) { await reader.cancel(); throw new VaultError("This upload exceeds the file-size limit.", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
}
