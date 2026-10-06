import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database } from "../../../../lib/server/database";
import { audit } from "../../../../lib/server/audit";
import { listInvoices } from "../../../../lib/server/invoices";
import { listDocuments, safeError, VaultError } from "../../../../lib/server/vault";
import { requireWorkspace, sameOriginWrite } from "../../../../lib/server/workspaces";
import { boundedJson } from "../../../../lib/server/request-body";
import { requireRecentStrong } from "../../../../lib/server/assurance";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { workspace, identity } = await requireWorkspace(request, "workspace.export");
    await requireRecentStrong(identity);
    if (!["OWNER", "ADMIN"].includes(workspace.role)) throw new VaultError("Only business administrators can export workspace information.", 403);
    const db = await database();
    const [invoices, documents, preferences, events, requests] = await Promise.all([
      listInvoices(workspace.id), listDocuments(workspace.id),
      db.query("SELECT brand,reminders,revision FROM workspace_preferences WHERE workspace_id=$1", [workspace.id]),
      db.query("SELECT action,entity_id,metadata,created_at FROM workspace_audit WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 500", [workspace.id]),
      db.query("SELECT id,kind,status,created_at FROM privacy_request WHERE workspace_id=$1", [workspace.id]),
    ]);
    await audit(db, workspace.id, identity.user.id, "privacy.export", undefined, { invoices: invoices.length, documents: documents.length });
    return Response.json({ generatedAt: new Date().toISOString(), scope: "workspace record summary; originals and archived history require a separate reviewed export", account: { name: identity.user.name, email: identity.user.email }, workspace, invoices, documents, preferences: preferences.rows, audit: events.rows, requests: requests.rows }, { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="invoiceflow-workspace-summary.json"' } });
  } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  try {
    sameOriginWrite(request); const { workspace, identity } = await requireWorkspace(request);
    const value = z.object({ kind: z.enum(["access", "correction", "deletion"]) }).strict().safeParse(await boundedJson(request, 1000));
    if (!value.success) throw new VaultError("Choose an access, correction or deletion request.", 422);
    const id = randomUUID();
    await (await database()).transaction(async tx => {
      await tx.query("INSERT INTO privacy_request(id,workspace_id,actor_id,kind) VALUES($1,$2,$3,$4)", [id, workspace.id, identity.user.id, value.data.kind]);
      await audit(tx, workspace.id, identity.user.id, "privacy.request", id, { kind: value.data.kind });
    });
    return Response.json({ id, status: "pending", message: "Request recorded for operator review. No financial records have been deleted and no email has been sent." }, { status: 201 });
  } catch (error) { return safeError(error); }
}
