import { requireWorkspace } from "../../../lib/server/workspaces";
import { listDocuments, localOnly, safeError, storeDocument, VaultError } from "../../../lib/server/vault";
import { extract, validateFile } from "../../../lib/server/extraction";
import { randomUUID } from "node:crypto";
import { storeOriginal } from "../../../lib/server/object-storage";
import { boundedMultipart } from "../../../lib/server/request-body";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { localOnly(request); const { workspace } = await requireWorkspace(request, request.method !== "GET"); return Response.json({ documents: await listDocuments(workspace.id) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  try {
    localOnly(request); const { workspace, identity } = await requireWorkspace(request, true);
    const length = Number(request.headers.get("content-length"));
    if (!length || length > 11 * 1024 * 1024) throw new VaultError("Upload one file up to 10 MB.", 413);
    const form = await boundedMultipart(request, 11 * 1024 * 1024);
    const file = form.get("file");
    if (!(file instanceof File)) throw new VaultError("Choose a file to upload.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = validateFile(bytes, file.name, file.type);
    const id = randomUUID();
    await storeOriginal(workspace.id, id, bytes);
    const result = await extract(bytes, mime);
    return Response.json(await storeDocument(workspace.id, bytes, { name: file.name.slice(0, 255), mime, ...result, status: "Review", record: null }, id, identity.user.id), { status: 201 });
  } catch (error) { return safeError(error); }
}

