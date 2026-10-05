"use client";
import { useState, type FormEvent } from "react";
import AppShell from "../../components/app-shell";
import styles from "../../vault.module.css";
import formStyles from "../../auth.module.css";
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
  return (
    <AppShell
      title="Keep your space secure."
      subtitle="Manage your password and account sessions."
    >
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
      <p className={styles.footnote}>
        Sessions expire after seven days. Password recovery by email is deferred
        until email delivery is configured.
      </p>
    </AppShell>
  );
}
