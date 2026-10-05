import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../workspace-provider";
import { completeEntry, engagementKey, readEngagement, startVisit, type Visit } from "../../../lib/tax/engagement";
const emptyVisit = (): Visit => ({ engagement: readEngagement(null), insight: null });
function save(key: string, visit: Visit) {
  try { window.localStorage.setItem(key, JSON.stringify(visit.engagement)); } catch { /* In-memory engagement still works when storage is unavailable. */ }
}
export function useTaxEngagement() {
  const workspace = useWorkspace();
  const key = workspace ? engagementKey(workspace.user.id, workspace.workspace.id) : "";
  const loaded = useRef<{ key: string; visit: Visit } | null>(null);
  const [visible, setVisible] = useState<{ key: string; visit: Visit }>({ key: "", visit: emptyVisit() });
  useEffect(() => {
    if (!key) return;
    // Strict Mode's repeated setup must not rotate the suggestion twice.
    if (loaded.current?.key !== key) {
      let stored: string | null = null;
      try { stored = window.localStorage.getItem(key); } catch { /* Optional storage. */ }
      loaded.current = { key, visit: startVisit(readEngagement(stored)) };
      save(key, loaded.current.visit);
    }
    const snapshot = loaded.current;
    const timer = window.setTimeout(() => setVisible(snapshot!), 0);
    return () => window.clearTimeout(timer);
  }, [key]);
  function recordEntry() {
    if (!key || loaded.current?.key !== key) return;
    const next = { key, visit: completeEntry(loaded.current.visit) };
    loaded.current = next;
    save(key, next.visit);
    setVisible(next);
  }
  return { insight: visible.key === key ? visible.visit.insight : null, recordEntry };
}
