import { boundedJson } from "../../../lib/server/request-body";
import {
  requireWorkspace,
  sameOriginWrite,
} from "../../../lib/server/workspaces";
import { safeError, VaultError } from "../../../lib/server/vault";
import {
  listContacts,
  saveContact,
  archiveContact,
} from "../../../lib/server/directory";
import { contactSchema } from "../../../lib/domain/contact";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { workspace } = await requireWorkspace(request);
    return Response.json(
      { contacts: await listContacts(workspace.id) },
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
    if (Number(request.headers.get("content-length")) > 10000)
      throw new VaultError("Contact details are too long.", 413);
    const body = await boundedJson(request, 10000);
    if (
      body.id !== undefined &&
      (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))
    )
      throw new VaultError("Choose a valid contact.");
    if (typeof body.archive === "boolean" && typeof body.id === "string")
      await archiveContact(workspace.id, body.id, body.archive);
    else {
      const input = contactSchema.safeParse(body);
      if (!input.success)
        throw new VaultError("Check the contact name, email and details.", 422);
      await saveContact(
        workspace.id,
        input.data,
        typeof body.id === "string" ? body.id : undefined,
      );
    }
    return Response.json({ contacts: await listContacts(workspace.id) });
  } catch (error) {
    return safeError(error);
  }
}
