"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/app-shell";
import { useWorkspace } from "../../components/workspace-provider";
import { readBrand, saveBrand } from "../../../lib/local-data";
import styles from "../../vault.module.css";
import formStyles from "../../auth.module.css";
export default function Page() {
  const context = useWorkspace(),
    router = useRouter(),
    profile = context?.workspace.profile;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const next: Record<string, string | boolean> = {
      ...(Object.fromEntries(data) as Record<string, string>),
      gstRegistered: data.get("gstRegistered") === "on",
    };
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "profile", profile: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const brand = readBrand();
      if (brand)
        saveBrand({
          ...brand,
          company: String(next.legalName),
          companyAddress: String(next.address),
          businessIdentifier: String(next.businessNumber),
          brand: String(next.accent),
          payment: String(next.payment),
        });
      setMessage(
        "Business profile saved. Your local branding defaults have been updated.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="Your business profile."
      subtitle="Organisation details and defaults, saved to your private workspace."
    >
      <section className={styles.panel} data-glow="true">
        <form className={formStyles.form} onSubmit={submit}>
          <label className={formStyles.field}>
            Legal business name
            <input
              name="legalName"
              defaultValue={profile?.legalName || context?.workspace.name}
              required
              minLength={2}
              maxLength={160}
            />
          </label>
          <div className={formStyles.pair}>
            <label className={formStyles.field}>
              Country
              <select
                name="country"
                defaultValue={profile?.country || "Australia"}
              >
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
            <label className={formStyles.field}>
              Invoice currency
              <select name="currency" defaultValue={profile?.currency || "AUD"}>
                {["AUD", "USD", "GBP", "EUR"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={formStyles.field}>
            Industry
            <input
              name="industry"
              defaultValue={profile?.industry || "Other"}
              required
              maxLength={100}
            />
          </label>
          <label className={formStyles.field}>
            ABN / business number
            <input
              name="businessNumber"
              defaultValue={profile?.businessNumber || ""}
              maxLength={80}
            />
          </label>
          <label className={formStyles.field}>
            Address
            <textarea
              name="address"
              defaultValue={profile?.address || ""}
              maxLength={1000}
            />
          </label>
          <label className={formStyles.check}>
            <input
              type="checkbox"
              name="gstRegistered"
              defaultChecked={profile?.gstRegistered}
            />
            Business is GST registered
          </label>
          <label className={formStyles.field}>
            Brand accent
            <input
              name="accent"
              type="color"
              defaultValue={profile?.accent || "#7240c4"}
            />
          </label>
          <label className={formStyles.field}>
            Payment instructions
            <textarea
              name="payment"
              defaultValue={profile?.payment || ""}
              maxLength={3000}
            />
          </label>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Saving…" : "Save business profile"}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    </AppShell>
  );
}
