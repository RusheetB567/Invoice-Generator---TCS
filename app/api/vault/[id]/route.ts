import { requireWorkspace } from "../../../../lib/server/workspaces";
import { confirmDocument, getDocument, localOnly, originalFile, safeError, VaultError } from "../../../../lib/server/vault";
import { taxRecordSchema } from "../../../../lib/domain/tax-record";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    localOnly(request); const { workspace } = await requireWorkspace(request, request.method !== "GET"); const { id } = await context.params; const document = await getDocument(workspace.id, id);
    if (new URL(request.url).searchParams.has("preview") && document.mime === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: await originalFile(workspace.id, id), isEvalSupported: false });
      try {
        const page = Number(new URL(request.url).searchParams.get("page") || "1");
        if (!Number.isInteger(page) || page < 1 || page > 20) throw new VaultError("Choose a valid page.");
        const info = await parser.getInfo({ parsePageInfo: true, partial: [page] });
        if (info.pages.some(value => !value.width || !value.height || value.width > 20000 || value.height > 20000 || value.height / value.width > 8 || value.width / value.height > 8)) throw new VaultError("This page cannot be previewed safely.");
        const preview = await parser.getScreenshot({ desiredWidth: 1400, partial: [page] });
        if (!preview.pages[0]) throw new VaultError("Page not found.",404);
        return new Response(new Uint8Array(preview.pages[0].data), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      } finally { await parser.destroy(); }
    }
    if (new URL(request.url).searchParams.has("file")) return new Response(new Uint8Array(await originalFile(workspace.id, id)), { headers: { "Content-Type": document.mime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Content-Disposition": `${document.source ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(document.name)}` } });
    return Response.json({ document }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    localOnly(request); const { workspace } = await requireWorkspace(request, request.method !== "GET"); const { id } = await context.params; await getDocument(workspace.id, id);
    const length = Number(request.headers.get("content-length"));
    if (!length || length > 20000) throw new VaultError("Record details must be a bounded request up to 20 KB.", 413);
    const input = taxRecordSchema.safeParse(await request.json());
    if (!input.success) return Response.json({ error: input.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(" ") }, { status: 422 });
    return Response.json({ document: await confirmDocument(workspace.id, id, input.data) });
  } catch (error) { return safeError(error); }
}

