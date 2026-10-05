import { requireWorkspace } from "../../../../../lib/server/workspaces";
import { localOnly, safeError } from "../../../../../lib/server/vault";
import { getImport, commitImport } from "../../../../../lib/server/spreadsheet-import";
import { boundedJson } from "../../../../../lib/server/request-body";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { localOnly(request); const { workspace } = await requireWorkspace(request); const { id } = await context.params; return Response.json({ batch: await getImport(workspace.id, id) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
export async function POST(request: Request, context: Context) {
  try { localOnly(request); const { workspace } = await requireWorkspace(request, true); const { id } = await context.params; return Response.json(await commitImport(workspace.id, id, await boundedJson(request, 4 * 1024 * 1024)), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
