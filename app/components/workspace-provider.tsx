"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { BusinessWorkspace } from "../../lib/domain/business";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { setWorkspaceScope, loadServerState, pendingLegacyDrafts, saveDraft } from "../../lib/local-data";
type Context = {
  securityLocked?: boolean;
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
  const [readyScope, setReadyScope] = useState("");
  const [error, setError] = useState("");
  const [legacyCount, setLegacyCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const securityPage = usePathname() === "/settings/security";
  const scopeKey = `${value.user.id}:${value.workspace.id}:${securityPage}:${value.securityLocked}`;
  const ready = securityPage || (!value.securityLocked && readyScope === scopeKey);
  useEffect(() => {
    setWorkspaceScope(`${value.user.id}:${value.workspace.id}`, securityPage || value.securityLocked);
    if (securityPage || value.securityLocked) return () => setWorkspaceScope(null);
    let cancelled = false;
    loadServerState().then(() => { if (!cancelled) { setLegacyCount(pendingLegacyDrafts().length); setError(""); setReadyScope(scopeKey); } }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to open your saved workspace."); });
    return () => {
      cancelled = true;
      setWorkspaceScope(null);
    };
  }, [
    value.user.id,
    value.workspace.id,
    securityPage,
    value.securityLocked,
    scopeKey,
  ]);
  async function migrateLegacy() {
    setMigrating(true); setError("");
    try {
      // Explicit import keeps the original browser data untouched for recovery.
      for (const draft of pendingLegacyDrafts()) {
        const existing = await fetch(`/api/invoices/${encodeURIComponent(draft.id)}`, { cache: "no-store" });
        // Existing or archived server versions must never be overwritten by older browser data.
        if (existing.ok) continue;
        if (existing.status !== 404) throw new Error("Unable to check this older draft. Try again later.");
        await saveDraft({ ...draft, revision: 0 });
      }
      setLegacyCount(0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Some drafts could not be imported. Your browser copies remain available."); }
    finally { setMigrating(false); }
  }
  return (
    <WorkspaceContext.Provider value={value}>
      {ready ? (
        <>{!securityPage && legacyCount > 0 && <div role="status" className="workspaceMigration">{legacyCount} older drafts remain in this browser. <button type="button" disabled={migrating} onClick={migrateLegacy}>{migrating ? "Importing…" : "Import into this workspace"}</button></div>}{!securityPage && error && <p role="alert">{error}</p>}{children}</>
      ) : (
        <div
          role="status"
          className="workspaceLoading"
        >
          {value.securityLocked ? "Verify your authenticator in Account security before opening business records." : error || "Opening your private workspace…"}{(error || value.securityLocked) && <><Link href="/settings/security">Open account security</Link><button type="button" onClick={() => window.location.reload()}>Try again</button></>}
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
