import { requireWorkspace } from "../../../../lib/server/workspaces";
import { localOnly, safeError, VaultError } from "../../../../lib/server/vault";
import { createImport, listImports } from "../../../../lib/server/spreadsheet-import";
import { MAX_XLSX_BYTES } from "../../../../lib/server/xlsx-reader";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { localOnly(request); const { workspace } = await requireWorkspace(request); return Response.json({ imports: await listImports(workspace.id) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  try {
    localOnly(request); const { workspace, identity } = await requireWorkspace(request, true);
    const reader = request.body?.getReader(); if (!reader) throw new VaultError("Choose an Excel workbook.");
    const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > MAX_XLSX_BYTES) { await reader.cancel(); throw new VaultError("Choose an .xlsx file up to 5 MB.", 413); } chunks.push(next.value); } } finally { reader.releaseLock(); }
    const result = await createImport(workspace.id, Buffer.concat(chunks), new URL(request.url).searchParams.get("name") ?? "", identity.user.id);
    return Response.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}
