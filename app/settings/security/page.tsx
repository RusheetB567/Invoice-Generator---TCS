"use client";
import { useState, type FormEvent } from "react";
import AppShell from "../../components/app-shell";
import styles from "../../vault.module.css";
import formStyles from "../../auth.module.css";
import AuthenticatorPanel from "../../components/authenticator-panel";
import ProtectedExport from "../../components/protected-export";
export default function Page() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function operation(path: string, body: unknown) {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        value.message || value.error || "Could not complete this request.",
      );
  }
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setMessage("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await operation("change-password", {
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
        revokeOtherSessions: true,
      });
      form.reset();
      setMessage("Password changed. Other sessions have been signed out.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to change password.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setMessage("");
    try {
      await operation("revoke-other-sessions", {});
      setMessage(
        "Other sessions have been signed out. This session remains active.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to revoke sessions.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function privacyRequest(kind: string) {
    if (kind === "deletion" && !window.confirm("Record a deletion request for review? Financial records will be retained until applicable obligations are checked.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspace/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.error); setMessage(value.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record this request."); }
    finally { setBusy(false); }
  }
  return (
    <AppShell
      title="Keep your space secure."
      subtitle="Manage your password and account sessions."
    >
      <AuthenticatorPanel />
      <section className={styles.panel} data-glow="true">
        <h2>Change password</h2>
        <form className={formStyles.form} onSubmit={change}>
          <label className={formStyles.field}>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <div className={formStyles.pair}>
            <label className={formStyles.field}>
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label className={formStyles.field}>
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
          </div>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Please wait…" : "Change password"}
          </button>
        </form>
      </section>
      <section className={styles.panel} data-glow="true">
        <h2>Other sessions</h2>
        <p>Sign out other devices while keeping this session active.</p>
        <button className={styles.secondary} disabled={busy} onClick={revoke}>
          Sign out other sessions
        </button>
      </section>
      {message && <p role="status">{message}</p>}
      <section className={styles.panel}><details><summary>Privacy and workspace records</summary><p>Download a record summary or request operator review. Financial evidence is retained until its obligations have been checked.</p><ProtectedExport href="/api/workspace/privacy" filename="invoiceflow-workspace-summary.json" permission="workspace.export">Download workspace summary</ProtectedExport><p>Full access or correction requests can include information outside this summary.</p><button className={styles.secondary} disabled={busy} onClick={() => privacyRequest("access")}>Request access review</button>{" "}<button className={styles.secondary} disabled={busy} onClick={() => privacyRequest("correction")}>Request correction</button>{" "}<button className={styles.secondary} disabled={busy} onClick={() => privacyRequest("deletion")}>Request deletion review</button></details></section>
      <p className={styles.footnote}>
        Sessions expire after seven days. Recovery by email requires configured delivery.
        Recovery codes restore sign-in; an authenticator is still needed for sensitive actions.
      </p>
    </AppShell>
  );
}
