import { requireWorkspace, sameOriginWrite } from "../../../lib/server/workspaces";
import { saveInvoice, invoiceSummary, validateInvoice, getInvoice, workspaceState } from "../../../lib/server/invoices";
import { boundedJson } from "../../../lib/server/request-body";
import { safeError } from "../../../lib/server/vault";
import { requireRecentStrong } from "../../../lib/server/assurance";
import { requirePermission } from "../../../lib/server/permissions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOriginWrite(request);
    const { workspace, identity } = await requireWorkspace(request, "invoice.write");
    const input = validateInvoice(await boundedJson(request, 3500000));
    const previous = input.revision ? await getInvoice(workspace.id, input.id) : undefined;
    const approvedPayment = previous?.payload.form.payment ?? (await workspaceState(workspace)).brand.payment;
    if (input.form.payment !== approvedPayment) { requirePermission(workspace, "business.manage"); await requireRecentStrong(identity); }
    const invoice = await saveInvoice(workspace.id, identity.user.id, input);
    return Response.json({ invoice, summary: await invoiceSummary(workspace.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}
