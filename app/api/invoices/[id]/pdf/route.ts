import { requireWorkspace } from "../../../../../lib/server/workspaces";
import { safeError } from "../../../../../lib/server/vault";
import { savedInvoicePdf } from "../../../../../lib/server/invoice-pdf";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { workspace, identity } = await requireWorkspace(request); const { id } = await context.params;
    const { bytes, invoice } = await savedInvoicePdf(workspace.id, identity.user.id, id);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Invoice-${invoice.number}-v${invoice.revision}.pdf`)}` } });
  } catch (error) { return safeError(error); }
}
