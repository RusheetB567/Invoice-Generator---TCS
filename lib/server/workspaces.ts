import { randomUUID } from "node:crypto";
import { getAuth } from "./auth";
import { database, VaultError } from "./vault";
import type { BusinessProfile, BusinessWorkspace } from "../domain/business";
import { production, requestOrigin } from "./config";
import { limitWorkspace } from "./rate-limit";
import { audit } from "./audit";
import { requirePermission, type Permission } from "./permissions";
import { requireMfaSession } from "./assurance";
export async function currentIdentity(request: Request) {
  const session = await (
    await getAuth(requestOrigin(request))
  ).api.getSession({ headers: request.headers });
  if (!session) throw new VaultError("Sign in to access your workspace.", 401);
  if (production() && !session.user.emailVerified) throw new VaultError("Verify your email before accessing your business workspace.", 403);
  return session;
}
export async function findWorkspace(userId: string) {
  const result = await (
    await database()
  ).query<BusinessWorkspace>(
    "SELECT b.*,m.role FROM business_workspace b JOIN workspace_membership m ON m.workspace_id=b.id WHERE m.user_id=$1",
    [userId],
  );
  return result.rows[0] ?? null;
}
export async function createWorkspace(userId: string, name: string) {
  return (await database()).transaction(async (tx) => {
    // Serialises double clicks and parallel requests for one account.
    await tx.query("SELECT id FROM auth_user WHERE id=$1 FOR UPDATE", [userId]);
    const existing = await tx.query(
      "SELECT workspace_id FROM workspace_membership WHERE user_id=$1",
      [userId],
    );
    if (existing.rows.length)
      throw new VaultError(
        "Your workspace already exists. Continue organisation setup.",
        409,
      );
    const id = randomUUID();
    await tx.query("INSERT INTO business_workspace(id,name) VALUES($1,$2)", [
      id,
      name,
    ]);
    await tx.query(
      "INSERT INTO workspace_membership(workspace_id,user_id,role) VALUES($1,$2,'OWNER')",
      [id, userId],
    );
    await audit(tx, id, userId, "workspace.create", id);
    return id;
  });
}
export async function finishOnboarding(
  userId: string,
  profile: BusinessProfile,
) {
  await (await database()).transaction(async tx => {
  const result = await tx.query(
    "UPDATE business_workspace b SET profile=$2,onboarding_complete=TRUE FROM workspace_membership m WHERE m.workspace_id=b.id AND m.user_id=$1 AND m.role IN ('OWNER','ADMIN') RETURNING b.id",
    [userId, JSON.stringify(profile)],
  );
  if (!result.rows.length)
    throw new VaultError(
      "You do not have permission to update this business.",
      403,
    );
  await audit(tx, String((result.rows[0] as { id: string }).id), userId, "business.profile.update");
  });
}
export async function requireWorkspace(request: Request, access: boolean | Permission = false) {
  const identity = await currentIdentity(request);
  const workspace = await findWorkspace(identity.user.id);
  if (!workspace?.onboarding_complete)
    throw new VaultError("Complete your organisation setup first.", 409);
  await limitWorkspace(identity.user.id, workspace.id, request);
  try {
    requirePermission(workspace, typeof access === "string" ? access : access ? "invoice.write" : "invoice.read");
    await requireMfaSession(identity, workspace.role);
  } catch (error) {
    if (error instanceof VaultError) await audit(await database(), workspace.id, identity.user.id, "security.access_denied", undefined, { code: error.code || "DENIED" });
    throw error;
  }
  return { identity, workspace };
}
export function sameOriginWrite(request: Request) {
  if (
    request.headers.get("origin") !== requestOrigin(request) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new VaultError("This request is not allowed.", 403);
}
