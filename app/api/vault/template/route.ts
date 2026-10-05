import { requireWorkspace } from "../../../../lib/server/workspaces";
import { localOnly, safeError } from "../../../../lib/server/vault";
import { importTemplate } from "../../../../lib/server/import-template";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { localOnly(request); await requireWorkspace(request); return new Response(new Uint8Array(await importTemplate()), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="TCS-InvoiceFlow-import-template.xlsx"', "Cache-Control": "no-store" } }); } catch (error) { return safeError(error); }
}
