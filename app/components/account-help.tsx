"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "../auth.module.css";
export default function AccountHelp({ reset = false, enabled }: { reset?: boolean; enabled: boolean }) {
  const query = useSearchParams(), [kind, setKind] = useState("reset"), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !enabled) return; setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      if (reset && data.get("password") !== data.get("confirm")) throw new Error("The passwords do not match.");
      const token = query.get("token");
      if (reset && !token) throw new Error("Open the reset link from your email.");
      const route = reset ? "reset-password" : kind === "reset" ? "request-password-reset" : "send-verification-email";
      const body = reset ? { token, newPassword: data.get("password") } : kind === "reset" ? { email: data.get("email"), redirectTo: "/reset-password" } : { email: data.get("email"), callbackURL: "/sign-in" };
      const response = await fetch(`/api/auth/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || "Unable to complete this request.");
      setMessage(reset ? "Password reset. Sign in with your new password. Previous sessions have been revoked." : "If the account is eligible, a private link will be emailed. Check your inbox.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to complete this request."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><section className={styles.card}><Link href="/sign-in">Back to sign in</Link><h1>{reset ? "Reset password" : "Account help"}</h1>{!enabled ? <p>Email delivery is not configured on this installation.</p> : <form className={styles.form} onSubmit={submit}>{!reset && <><label className={styles.field}>What do you need?<select value={kind} onChange={event => setKind(event.target.value)}><option value="reset">Reset password</option><option value="verify">Resend verification</option></select></label><label className={styles.field}>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label></>}{reset && <><label className={styles.field}>New password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className={styles.field}>Confirm password<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label></>}<button className={styles.primary} disabled={busy}>{busy ? "Please wait…" : reset ? "Reset password" : "Send link"}</button></form>}{message && <p role="status">{message}</p>}</section></main>;
}
