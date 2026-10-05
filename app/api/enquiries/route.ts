import { boundedJson } from "../../../lib/server/request-body";
import { randomUUID } from "node:crypto";
import {
  requireWorkspace,
  sameOriginWrite,
} from "../../../lib/server/workspaces";
import { database, safeError, VaultError } from "../../../lib/server/vault";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { workspace } = await requireWorkspace(request);
    const result = await (
      await database()
    ).query(
      "SELECT id,question,created_at FROM workspace_enquiry WHERE workspace_id=$1 ORDER BY created_at DESC",
      [workspace.id],
    );
    return Response.json(
      { enquiries: result.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOriginWrite(request);
    const { workspace } = await requireWorkspace(request, true);
    if (Number(request.headers.get("content-length")) > 6000)
      throw new VaultError("Keep your question under 1,500 characters.", 413);
    const body = await boundedJson(request, 6000);
    if (
      typeof body.question !== "string" ||
      body.question.trim().length < 5 ||
      body.question.length > 1500
    )
      throw new VaultError(
        "Enter a question between 5 and 1,500 characters.",
        422,
      );
    await (
      await database()
    ).query(
      "INSERT INTO workspace_enquiry(id,workspace_id,question) VALUES($1,$2,$3)",
      [randomUUID(), workspace.id, body.question.trim()],
    );
    return Response.json({ saved: true });
  } catch (error) {
    return safeError(error);
  }
}
