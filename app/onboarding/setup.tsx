"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { BusinessWorkspace } from "../../lib/domain/business";
import styles from "../auth.module.css";
export default function Onboarding({
  firstName,
  existing,
}: {
  firstName: string;
  existing: BusinessWorkspace | null;
}) {
  const [workspace, setWorkspace] = useState(existing),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [accent, setAccent] = useState("#7240c4");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const profile = {
      legalName: data.get("legalName"),
      address: data.get("address"),
      country: data.get("country"),
      businessNumber: data.get("businessNumber"),
      currency: data.get("currency"),
      industry: data.get("industry"),
      gstRegistered: data.get("gstRegistered") === "on",
      accent,
      payment: data.get("payment"),
    };
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          workspace
            ? { step: "profile", profile }
            : { step: "create", name: data.get("name") },
        ),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "We could not save your organisation.");
      if (workspace)
        /* Full navigation discards private route caches after an authentication or workspace change. */
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/workspace");
      else {
        setWorkspace(body.workspace);
        setPending(false);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to connect.");
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
          <span className={styles.eyebrow}>
            ACCOUNT CREATED / STEP {workspace ? "02" : "01"} OF 02
          </span>
          <h1>
            {firstName},<br />
            let’s make it
            <br />
            <em>your business.</em>
          </h1>
          <p>
            {workspace
              ? "Choose your business defaults. These details help personalise your invoice creator."
              : "Your account is ready. Give your organisation a private workspace of its own."}
          </p>
          <ol className={styles.steps}>
            <li>
              <span>✓</span>Account created
            </li>
            <li>
              <span>{workspace ? "✓" : "01"}</span>Business workspace
            </li>
            <li>
              <span>02</span>Organisation profile
            </li>
          </ol>
          <p className={styles.note}>
            Your email remains unverified. Verification is deferred until email
            delivery is configured.
          </p>
        </div>
        <section className={styles.card} key={workspace?.id || "create"}>
          <h2>
            {workspace
              ? "Organisation onboarding"
              : "Create a business workspace"}
          </h2>
          <p>
            {workspace
              ? workspace.name
              : "You can use your company name or trading name."}
          </p>
          <form className={styles.form} onSubmit={submit}>
            {!workspace ? (
              <label className={styles.field}>
                Workspace name
                <input
                  name="name"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
            ) : (
              <>
                <label className={styles.field}>
                  Legal business name
                  <input
                    name="legalName"
                    defaultValue={workspace.name}
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="organization"
                  />
                </label>
                <div className={styles.pair}>
                  <label className={styles.field}>
                    Country
                    <select name="country" defaultValue="Australia">
                      {[
                        "Australia",
                        "New Zealand",
                        "United Kingdom",
                        "United States",
                        "Other",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Invoice currency
                    <select name="currency" defaultValue="AUD">
                      {["AUD", "USD", "GBP", "EUR"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.field}>
                  Industry
                  <select name="industry" defaultValue="Professional services">
                    {[
                      "Professional services",
                      "Technology",
                      "Creative & design",
                      "Construction & trades",
                      "Retail",
                      "Healthcare",
                      "Transport & logistics",
                      "Other",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  ABN / business registration number{" "}
                  <span className={styles.note}>
                    Optional — enter the identifier that applies to your
                    business.
                  </span>
                  <input name="businessNumber" maxLength={80} />
                </label>
                <label className={styles.field}>
                  Business address
                  <textarea
                    name="address"
                    rows={2}
                    maxLength={1000}
                    autoComplete="street-address"
                  />
                </label>
                <label className={styles.check}>
                  <input name="gstRegistered" type="checkbox" />
                  My business is GST registered
                </label>
                <div className={styles.field}>
                  Brand accent
                  <div className={styles.swatches}>
                    {["#7240c4", "#515bea", "#257864", "#34313e"].map(
                      (color) => (
                        <button
                          key={color}
                          type="button"
                          style={{ background: color }}
                          aria-label={`Brand accent ${color}`}
                          aria-pressed={accent === color}
                          onClick={() => setAccent(color)}
                        />
                      ),
                    )}
                  </div>
                </div>
                <label className={styles.field}>
                  Payment instructions
                  <textarea
                    name="payment"
                    rows={2}
                    maxLength={3000}
                    placeholder="Optional bank details or payment terms"
                  />
                </label>
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button className={styles.primary} disabled={pending}>
              {pending
                ? "Saving…"
                : workspace
                  ? "Open my private dashboard →"
                  : "Create workspace →"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
