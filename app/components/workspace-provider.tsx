"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { BusinessWorkspace } from "../../lib/domain/business";
import { setWorkspaceScope, readBrand, saveBrand } from "../../lib/local-data";
type Context = {
  user: {
    id: string;
    name: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  };
  workspace: BusinessWorkspace;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
export default function WorkspaceProvider({
  value,
  children,
}: {
  value: Context;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setWorkspaceScope(`${value.user.id}:${value.workspace.id}`);
    if (!readBrand()) {
      const profile = value.workspace.profile;
      try {
        saveBrand({
          company: profile.legalName || value.workspace.name,
          tagline: "",
          companyAddress: profile.address || "",
          businessIdentifier: profile.businessNumber || "",
          brand: profile.accent || "#7240c4",
          payment: profile.payment || "",
          logo: "",
        });
      } catch {
        /* Editor still supports browsers with unavailable local storage. */
      }
    }
    // This hydration barrier prevents mounting an editor before its workspace storage is selected.
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => {
      window.clearTimeout(timer);
      setWorkspaceScope(null);
    };
  }, [
    value.user.id,
    value.workspace.id,
    value.workspace.name,
    value.workspace.profile,
  ]);
  return (
    <WorkspaceContext.Provider value={value}>
      {ready ? (
        children
      ) : (
        <div
          role="status"
          style={{
            padding: 60,
            color: "#d7c4ff",
            background: "#080610",
            minHeight: "100vh",
          }}
        >
          Opening your private workspace…
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
