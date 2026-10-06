import { requireWorkspace, sameOriginWrite } from "../../../../lib/server/workspaces";
import { savePreferences, workspaceState } from "../../../../lib/server/invoices";
import { boundedJson } from "../../../../lib/server/request-body";
import { safeError, VaultError } from "../../../../lib/server/vault";
import { requireRecentStrong } from "../../../../lib/server/assurance";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const { workspace } = await requireWorkspace(request); return Response.json(await workspaceState(workspace), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  try {
    sameOriginWrite(request); const { workspace, identity } = await requireWorkspace(request, "business.manage");
    if (!["OWNER", "ADMIN"].includes(workspace.role)) throw new VaultError("Only business administrators can change these preferences.", 403);
    const body = await boundedJson(request, 3500000);
    if (body.brand && typeof body.brand === "object" && "payment" in body.brand && body.brand.payment !== (await workspaceState(workspace)).brand.payment) await requireRecentStrong(identity);
    return Response.json(await savePreferences(workspace.id, identity.user.id, body));
  } catch (error) { return safeError(error); }
}
