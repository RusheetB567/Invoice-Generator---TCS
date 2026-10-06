"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../auth.module.css";
export default function AuthForm({ signup, emailEnabled = false }: { signup: boolean; emailEnabled?: boolean }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  const [success, setSuccess] = useState("");
  const [challenge, setChallenge] = useState(false), [recovery, setRecovery] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const firstName = String(fields.get("firstName") || "").trim(),
      lastName = String(fields.get("lastName") || "").trim();
    try {
      const response = await fetch(
        challenge ? `/api/auth/two-factor/${recovery ? "verify-backup-code" : "verify-totp"}` : `/api/auth/${signup ? "sign-up" : "sign-in"}/email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(challenge ? { code: String(fields.get("code") || "").trim() } : {
            email: String(fields.get("email")).trim(),
            password: fields.get("password"),
            ...(signup
              ? { firstName, lastName, name: `${firstName} ${lastName}`, callbackURL: "/sign-in" }
              : {}),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.message || body.error || "Check your details and try again.",
        );
      if (body.twoFactorRedirect) { setChallenge(true); setPending(false); return; }
      if (signup && emailEnabled && !body.authenticated) { setSuccess("Account created. Check your email to verify your address, then sign in to set up your business."); setPending(false); return; }
      /* Full navigation discards private route caches after an authentication or workspace change. */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/onboarding");
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "Unable to connect. Try again.",
      );
      setPending(false);
    }
  }
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.brand}>
        <span className={styles.mark}>{"</>"}</span>THE CODE SQUAD / INVOICEFLOW
      </Link>
      <main className={styles.grid}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>YOUR BUSINESS. YOUR OWN SPACE.</span>
          <h1>
            {signup ? (
              <>
                Big ideas.
                <br />
                Beautiful invoices.
                <br />
                <em>Your workspace.</em>
              </>
            ) : (
              <>
                Welcome back.
                <br />
                <em>Make work flow.</em>
              </>
            )}
          </h1>
          <p>
            Your business details, your invoice style, and an organised home for
            the documents you receive.
          </p>
          <ol className={styles.steps}>
            <li>
              <span>01</span>Create your account
            </li>
            <li>
              <span>02</span>Set up your organisation
            </li>
            <li>
              <span>03</span>Enter your private dashboard
            </li>
          </ol>
        </div>
        <section className={styles.card}>
          <h2>{challenge ? "Verify your sign-in" : signup ? "Create your account" : "Sign in to InvoiceFlow"}</h2>
          <p>
            {signup
              ? "A few details, then we’ll make this space yours."
              : "Continue to your business workspace."}
          </p>
          <form className={styles.form} onSubmit={submit}>
            {challenge ? <><label className={styles.field}>{recovery ? "Recovery code" : "Authenticator code"}<input name="code" autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"} required maxLength={32} /></label><details><summary>Use account recovery</summary><label><input type="checkbox" checked={recovery} onChange={event => setRecovery(event.target.checked)} /> Use a saved recovery code</label><p>Recovery restores sign-in. Sensitive actions still require your authenticator.</p></details></> : <>{signup && (
              <div className={styles.pair}>
                <label className={styles.field}>
                  First name
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={80}
                  />
                </label>
                <label className={styles.field}>
                  Last name
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={80}
                  />
                </label>
              </div>
            )}
            <label className={styles.field}>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <div className={styles.field}>
              <label htmlFor="account-password">Password</label>
              <div className={styles.password}>
                <input
                  id="account-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 12 : undefined}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {signup && (
              <span className={styles.note}>
                Use 12 or more characters. A unique passphrase works well.
              </span>
            )}
            </>}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {success && <p role="status">{success}</p>}
            <button className={styles.primary} disabled={pending}>
              {pending
                ? "Please wait…"
                : challenge ? "Verify and continue" : signup
                  ? "Create account →"
                  : "Sign in →"}
            </button>
          </form>
          <p>
            {signup ? "Already have an account? " : "New to InvoiceFlow? "}
            <Link
              className={styles.link}
              href={signup ? "/sign-in" : "/sign-up"}
            >
              {signup ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className={styles.note}>
            {emailEnabled ? <Link href="/account-help">Reset password or resend verification</Link> : "Email delivery is not configured on this local installation. Verification and password recovery are unavailable."}
            {" "}<Link href="/privacy">Privacy information</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
