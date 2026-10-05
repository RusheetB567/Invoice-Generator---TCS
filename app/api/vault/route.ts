import { listDocuments, localOnly, safeError, storeDocument, VaultError } from "../../../lib/server/vault";
import { extract, validateFile } from "../../../lib/server/extraction";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { localOnly(request); return Response.json({ documents: await listDocuments() }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  try {
    localOnly(request);
    const length = Number(request.headers.get("content-length"));
    if (!length || length > 11 * 1024 * 1024) throw new VaultError("Upload one file up to 10 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new VaultError("Choose a file to upload.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = validateFile(bytes, file.name, file.type);
    const result = await extract(bytes, mime);
    return Response.json(await storeDocument(bytes, { name: file.name.slice(0, 255), mime, ...result, status: "Review", record: null }), { status: 201 });
  } catch (error) { return safeError(error); }
}
