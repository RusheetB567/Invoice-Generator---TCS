"use client";
import { useEffect, useState, type FormEvent } from "react";
import AppShell from "../../components/app-shell";
import styles from "../../vault.module.css";
import formStyles from "../../auth.module.css";
type Enquiry = { id: string; question: string; created_at: string };
export default function Page() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]),
    [message, setMessage] = useState(""),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/enquiries", { signal: abort.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setEnquiries(body.enquiries);
        setLoading(false);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, [version]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setQuestion("");
      setMessage(
        "Question saved privately. You can discuss it with your accountant.",
      );
      setVersion((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell
      title="Keep your tax questions together."
      subtitle="A private notebook for questions to discuss with your accountant."
    >
      <section className={styles.panel} data-glow="true">
        <h2>Something to follow up?</h2>
        <form className={formStyles.form} onSubmit={submit}>
          <label className={formStyles.field}>
            Your question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              required
              minLength={5}
              maxLength={1500}
              rows={4}
              placeholder="For example: Which supporting records should I keep for this expense?"
            />
          </label>
          <button className={styles.primary} disabled={busy}>
            {busy ? "Saving…" : "Save question"}
          </button>
        </form>
        <p className={styles.footnote}>
          Questions stay in your business workspace. This does not send a
          message to the ATO or an accountant, and does not provide tax advice.
        </p>
      </section>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Loading saved questions…</p>
      ) : (
        enquiries.map((enquiry) => (
          <article className={styles.record} data-glow="true" key={enquiry.id}>
            <span className={styles.eyebrow}>
              {new Date(enquiry.created_at).toLocaleDateString("en-AU")}
            </span>
            <p style={{ whiteSpace: "pre-wrap" }}>{enquiry.question}</p>
          </article>
        ))
      )}
    </AppShell>
  );
}
