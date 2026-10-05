import { randomUUID } from "node:crypto";
import { getAuth } from "./auth";
import { database, VaultError } from "./vault";
import type { BusinessProfile, BusinessWorkspace } from "../domain/business";
export async function currentIdentity(request: Request) {
  const session = await (
    await getAuth(new URL(request.url).origin)
  ).api.getSession({ headers: request.headers });
  if (!session) throw new VaultError("Sign in to access your workspace.", 401);
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
    return id;
  });
}
export async function finishOnboarding(
  userId: string,
  profile: BusinessProfile,
) {
  const result = await (
    await database()
  ).query(
    "UPDATE business_workspace b SET profile=$2,onboarding_complete=TRUE FROM workspace_membership m WHERE m.workspace_id=b.id AND m.user_id=$1 AND m.role IN ('OWNER','ADMIN') RETURNING b.id",
    [userId, JSON.stringify(profile)],
  );
  if (!result.rows.length)
    throw new VaultError(
      "You do not have permission to update this business.",
      403,
    );
}
export async function requireWorkspace(request: Request, write = false) {
  const identity = await currentIdentity(request);
  const workspace = await findWorkspace(identity.user.id);
  if (!workspace?.onboarding_complete)
    throw new VaultError("Complete your organisation setup first.", 409);
  if (write && workspace.role === "VIEWER")
    throw new VaultError("This account has read-only access.", 403);
  return { identity, workspace };
}
export function sameOriginWrite(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new VaultError("This request is not allowed.", 403);
}
