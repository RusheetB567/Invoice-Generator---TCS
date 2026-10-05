import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentIdentity, findWorkspace } from "./workspaces";
import { VaultError } from "./vault";
export async function pageIdentity() {
  const incoming = await headers();
  const host = incoming.get("host") || "localhost:3000";
  try {
    return await currentIdentity(
      new Request(`http://${host}/`, { headers: incoming }),
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
  return {
    user: {
      id: identity.user.id,
      name: identity.user.name,
      email: identity.user.email,
      firstName: identity.user.firstName,
      lastName: identity.user.lastName,
      emailVerified: identity.user.emailVerified,
    },
    workspace,
  };
}
