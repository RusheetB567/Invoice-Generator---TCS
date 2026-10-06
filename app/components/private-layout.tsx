import type { ReactNode } from "react";
import { privateWorkspace } from "../../lib/server/page-access";
import WorkspaceProvider from "./workspace-provider";
export default async function PrivateLayout({
  children,
}: {
  children: ReactNode;
}) {
  const value = await privateWorkspace();
  return (
    <WorkspaceProvider
      key={`${value.user.id}:${value.workspace.id}:${value.securityLocked}`}
      value={value}
    >
      {children}
    </WorkspaceProvider>
  );
}
