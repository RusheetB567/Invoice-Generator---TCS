import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentIdentity, findWorkspace } from "./workspaces";
import { VaultError } from "./vault";
import { applicationOrigin } from "./config";
import { requireMfaSession } from "./assurance";
export async function pageIdentity() {
  const incoming = await headers();
  const host = incoming.get("host") || "localhost:3000";
  try {
    return await currentIdentity(
      new Request(`${applicationOrigin(process.env.BETTER_AUTH_URL || `http://${host}`)}/`, { headers: incoming }),
    );
  } catch (error) {
    if (error instanceof VaultError && error.status === 401)
      redirect("/sign-in");
    throw error;
  }
}
export async function privateWorkspace() {
  const identity = await pageIdentity();
  const workspace = await findWorkspace(identity.user.id);
  if (!workspace?.onboarding_complete) redirect("/onboarding");
  let securityLocked = false;
  try { await requireMfaSession(identity, workspace.role); }
  catch (error) { if (error instanceof VaultError && ["MFA_REQUIRED", "MFA_ENROLLMENT_REQUIRED"].includes(error.code || "")) securityLocked = true; else throw error; }
  return {
    securityLocked,
    user: {
      id: identity.user.id,
      name: identity.user.name,
      email: identity.user.email,
      firstName: identity.user.firstName,
      lastName: identity.user.lastName,
      emailVerified: identity.user.emailVerified,
    },
    workspace: securityLocked ? { ...workspace, profile: {} } : workspace,
  };
}
