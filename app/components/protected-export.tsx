"use client";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useWorkspace } from "./workspace-provider";
import { permitted, type Permission } from "../../lib/server/permissions";
import styles from "../vault.module.css";
export default function ProtectedExport({ href, filename, permission = "records.export", children, disabled = false, onDone }: { href: string; filename: string; permission?: Permission; children: ReactNode; disabled?: boolean; onDone?: () => void }) {
  const role = useWorkspace()?.workspace.role;
  const [busy, setBusy] = useState(false), [mode, setMode] = useState<"idle" | "verify" | "enroll">("idle"), [message, setMessage] = useState("");
  async function download() {
    const response = await fetch(href, { cache: "no-store" });
    if (!response.ok) { const value = await response.json().catch(() => ({})); if (value.code === "STEP_UP_REQUIRED") setMode("verify"); throw new Error(value.error || "Unable to export these records."); }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("spreadsheetml") && !type.includes("application/json")) throw new Error("Sign in again before downloading records.");
    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMode("idle"); setMessage("Download prepared."); onDone?.();
  }
  async function start() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/account/security", { cache: "no-store" }), value = await response.json(); if (!response.ok) throw new Error(value.error || "Sign in again."); if (!value.mfaEnabled) setMode("enroll"); else if (!value.recentlyVerified) setMode("verify"); else await download(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to export."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form); setBusy(true); setMessage("");
    try { const response = await fetch("/api/auth/two-factor/verify-totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: fields.get("code") }) }), value = await response.json(); if (!response.ok) throw new Error(value.error || value.message || "Unable to verify."); form.reset(); await download(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to export."); }
    finally { setBusy(false); }
  }
  if (!role || !permitted(role, permission)) return null;
  return <div><button type="button" className={styles.secondary} disabled={disabled || busy} onClick={start}>{busy ? "Please wait…" : children}</button>
    {mode === "enroll" && <p role="status">Set up an authenticator in <Link href="/settings/security">Account security</Link>, then return to download your records.</p>}
    {mode === "verify" && <form onSubmit={verify}><label className={styles.compactField}>Approve this export<input name="code" aria-label="Six-digit authenticator code" placeholder="Authenticator code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button disabled={busy} className={styles.primary}>Verify and download</button><button type="button" disabled={busy} className={styles.secondary} onClick={() => setMode("idle")}>Cancel</button></form>}
    {message && <p role="status">{message}</p>}
  </div>;
}
