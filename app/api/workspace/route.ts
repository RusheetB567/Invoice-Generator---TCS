import { boundedJson } from "../../../lib/server/request-body";
import {
  currentIdentity,
  findWorkspace,
  createWorkspace,
  finishOnboarding,
  sameOriginWrite,
} from "../../../lib/server/workspaces";
import {
  businessNameSchema,
  businessProfileSchema,
} from "../../../lib/domain/business";
import { safeError, VaultError } from "../../../lib/server/vault";
import { requireRecentStrong, requireMfaSession } from "../../../lib/server/assurance";
import { requirePermission } from "../../../lib/server/permissions";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const identity = await currentIdentity(request);
    const workspace = await findWorkspace(identity.user.id);
    if (workspace?.onboarding_complete) await requireMfaSession(identity, workspace.role);
    return Response.json(
      { user: identity.user, workspace },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOriginWrite(request);
    const identity = await currentIdentity(request);
    if (Number(request.headers.get("content-length")) > 10000)
      throw new VaultError("These business details are too long.", 413);
    const body = await boundedJson(request, 10000);
    if (body.step === "create") {
      const result = businessNameSchema.safeParse(body);
      if (!result.success)
        throw new VaultError(
          "Enter a business name between 2 and 160 characters.",
          422,
        );
      await createWorkspace(identity.user.id, result.data.name);
    } else if (body.step === "profile") {
      const result = businessProfileSchema.safeParse(body.profile);
      if (!result.success)
        throw new VaultError(
          result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" "),
          422,
        );
      const workspace = await findWorkspace(identity.user.id);
      if (!workspace) throw new VaultError("Create your business workspace first.", 409);
      requirePermission(workspace, "business.manage");
      if (workspace.onboarding_complete) await requireMfaSession(identity, workspace.role);
      if (result.data.payment !== (workspace.profile.payment || "")) await requireRecentStrong(identity);
      await finishOnboarding(identity.user.id, result.data);
    } else throw new VaultError("Choose a valid setup step.");
    return Response.json({ workspace: await findWorkspace(identity.user.id) });
  } catch (error) {
    return safeError(error);
  }
}
