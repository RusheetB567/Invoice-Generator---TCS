"use client";
import { useEffect, useState, type FormEvent } from "react";
import styles from "../vault.module.css";
import forms from "../auth.module.css";
import { useRouter } from "next/navigation";
type SecurityState = { mfaEnabled: boolean; mfaRequired: boolean; recentlyVerified: boolean; sessions: Array<{ id: string; created_at: string; expires_at: string; current: boolean }> };
async function operation(path: string, body: unknown) {
  const response = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || value.error || "Unable to complete verification.");
  return value;
}
async function readState(): Promise<SecurityState> {
  const response = await fetch("/api/account/security", { cache: "no-store" });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Unable to load security settings.");
  return value;
}
export default function AuthenticatorPanel() {
  const router = useRouter();
  const [state, setState] = useState<SecurityState | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<{ secret: string; codes: string[] } | null>(null), [codes, setCodes] = useState<string[]>([]);
  useEffect(() => { let cancelled = false; readState().then(value => { if (!cancelled) setState(value); }).catch(error => { if (!cancelled) setMessage(error.message); }); return () => { cancelled = true; }; }, []);
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form); setBusy(true); setMessage("");
    try {
      const value = await operation("two-factor/enable", { password: fields.get("password") });
      setEnrollment({ secret: new URL(value.totpURI).searchParams.get("secret") || "", codes: value.backupCodes });
      form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start enrollment."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form); setBusy(true); setMessage("");
    try {
      await operation("two-factor/verify-totp", { code: fields.get("code") });
      setEnrollment(null); form.reset(); setState(await readState());
      router.refresh();
      setMessage("Authenticator verified. You can retry your sensitive action for the next ten minutes.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to verify this code."); }
    finally { setBusy(false); }
  }
  async function advanced(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form), action = fields.get("action"); setBusy(true); setMessage("");
    try {
      const value = await operation(action === "disable" ? "two-factor/disable" : "two-factor/generate-backup-codes", { password: fields.get("password") });
      form.reset();
      if (action === "disable") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/sign-in");
      } else { setCodes(value.backupCodes); setMessage("Old recovery codes are invalid. Save the replacement codes now."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change security settings."); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} data-glow="true">
    <h2>Authenticator protection</h2>
    <p>{!state ? "Loading account security…" : state.mfaEnabled ? state.recentlyVerified ? "Enabled. Sensitive actions are verified for this session." : "Enabled. Verify a new code before exporting records or changing payment and security details." : "Add an authenticator app to protect sign-in and approve sensitive actions."}</p>
    {state?.mfaRequired && !state.mfaEnabled && <p role="alert">Authenticator setup is required before business records can be opened.</p>}
    {state && !state.mfaEnabled && !enrollment && <form className={forms.form} onSubmit={enroll}><label className={forms.field}>Current password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label><button className={styles.primary} disabled={busy}>Set up authenticator</button></form>}
    {enrollment && <><p>In your authenticator app, add a time-based account named TCS InvoiceFlow and enter this setup key. Keep it private.</p><label className={forms.field}>Setup key<input value={enrollment.secret} readOnly autoComplete="off" spellCheck={false} /></label><p>Save these one-time recovery codes in your password manager. They are shown only during this setup.</p><pre style={{ whiteSpace: "pre-wrap" }}>{enrollment.codes.join("\n")}</pre></>}
    {(state?.mfaEnabled || enrollment) && <form className={forms.form} onSubmit={verify}>
      {enrollment && <label><input type="checkbox" required /> I have saved my recovery codes securely.</label>}
      <label className={forms.field}>Six-digit authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button className={styles.primary} disabled={busy}>{busy ? "Verifying…" : enrollment ? "Confirm authenticator" : "Verify sensitive actions"}</button>
    </form>}
    {state?.mfaEnabled && <details><summary>Advanced account protection</summary><p>Verify a fresh authenticator code above before changing these settings.</p><form className={forms.form} onSubmit={advanced}><label className={forms.field}>Current password<input type="password" name="password" autoComplete="current-password" required maxLength={128} /></label><label className={forms.field}>Action<select name="action"><option value="regenerate">Replace recovery codes</option>{!state.mfaRequired && <option value="disable">Remove authenticator and sign out all sessions</option>}</select></label><button className={styles.secondary} disabled={busy}>Apply security change</button></form>{codes.length > 0 && <><pre>{codes.join("\n")}</pre><button type="button" className={styles.secondary} onClick={() => setCodes([])}>I have saved these codes</button></>}<h3>Active sessions</h3><ul>{state.sessions.map(session => <li key={session.id}>{session.current ? "This session" : "Another session"} · started {new Date(session.created_at).toLocaleDateString()} · expires {new Date(session.expires_at).toLocaleDateString()}</li>)}</ul></details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
