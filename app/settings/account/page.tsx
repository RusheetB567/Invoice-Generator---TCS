"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import AppShell from "../../components/app-shell";
import { useWorkspace } from "../../components/workspace-provider";
import styles from "../../vault.module.css";
import formStyles from "../../auth.module.css";
export default function Page() {
  const context = useWorkspace(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("firstName")).trim(),
      lastName = String(data.get("lastName")).trim();
    try {
      const response = await fetch("/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.error);
      setMessage("Account details saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="Your account."
      subtitle="The person behind your business workspace."
    >
      <section className={styles.panel} data-glow="true">
        <form className={formStyles.form} onSubmit={submit}>
          <div className={formStyles.pair}>
            <label className={formStyles.field}>
              First name
              <input
                name="firstName"
                defaultValue={context?.user.firstName}
                required
                maxLength={80}
              />
            </label>
            <label className={formStyles.field}>
              Last name
              <input
                name="lastName"
                defaultValue={context?.user.lastName}
                required
                maxLength={80}
              />
            </label>
          </div>
          <label className={formStyles.field}>
            Sign-in email
            <input value={context?.user.email || ""} readOnly type="email" />
          </label>
          <p className={styles.footnote}>
            {context?.user.emailVerified
              ? "Email verified."
              : "Email not yet verified. Verification and email changes will become available after email delivery is configured."}
          </p>
          <button disabled={busy} className={styles.primary}>
            {busy ? "Saving…" : "Save account details"}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    </AppShell>
  );
}
