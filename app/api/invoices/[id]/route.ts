import { requireWorkspace, sameOriginWrite } from "../../../../lib/server/workspaces";
import { archiveInvoice, getInvoice, invoiceSummary } from "../../../../lib/server/invoices";
import { boundedJson } from "../../../../lib/server/request-body";
import { safeError, VaultError } from "../../../../lib/server/vault";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try { const { workspace } = await requireWorkspace(request); const { id } = await context.params; return Response.json(await getInvoice(workspace.id, id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return safeError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOriginWrite(request); const { workspace, identity } = await requireWorkspace(request, "invoice.archive"); const { id } = await context.params;
    const { revision } = await boundedJson(request, 1000);
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) throw new VaultError("Reload this invoice before archiving.", 409);
    return Response.json({ invoice: await archiveInvoice(workspace.id, identity.user.id, id, revision), summary: await invoiceSummary(workspace.id) });
  } catch (error) { return safeError(error); }
}
