import { redirect } from "next/navigation";
import { pageIdentity } from "../../lib/server/page-access";
import { findWorkspace } from "../../lib/server/workspaces";
import Onboarding from "./setup";
export default async function Page() {
  const identity = await pageIdentity();
  const workspace = await findWorkspace(identity.user.id);
  if (workspace?.onboarding_complete) redirect("/workspace");
  return (
    <Onboarding firstName={identity.user.firstName} existing={workspace} />
  );
}
