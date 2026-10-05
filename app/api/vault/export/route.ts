import { requireWorkspace } from "../../../../lib/server/workspaces";
import { listDocuments, localOnly, safeError } from "../../../../lib/server/vault";
import { filterRecords } from "../../../../lib/domain/vault-filter";
import { exportVault } from "../../../../lib/server/vault-export";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    localOnly(request); const { workspace } = await requireWorkspace(request, request.method !== "GET"); const params = new URL(request.url).searchParams;
    const documents = filterRecords(await listDocuments(workspace.id), { year: params.get("year") ?? "", query: params.get("query") ?? "", kind: params.get("kind") ?? "", category: params.get("category") ?? "" });
    const ids = params.get("ids")?.split(",");
    const workbook = await exportVault(ids ? documents.filter(document => ids.includes(document.id)) : documents, { name: workspace.profile.legalName || workspace.name, businessNumber: workspace.profile.businessNumber, selection: [ids ? "Selected records" : "Filtered records", params.get("year") || "All financial years", params.get("kind"), params.get("category"), params.get("query") ? `Search: ${params.get("query")}` : ""].filter(Boolean).join(" · ") });
    return new Response(new Uint8Array(workbook), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="TCS-InvoiceFlow-records.xlsx"', "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}

