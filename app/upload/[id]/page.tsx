"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "../../components/app-shell";
import SpreadsheetSource from "../../components/records/spreadsheet-source";
import { categories, financialYear, treatments, taxRecordSchema, type TaxRecordInput, type VaultDocument } from "../../../lib/domain/tax-record";
import styles from "../../vault.module.css";
type Form = Omit<TaxRecordInput, "confirmed"> & { confirmed: boolean };
export default function DocumentReview() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<VaultDocument | null>(null), [form, setForm] = useState<Form | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [sourcePage, setSourcePage] = useState("1");
  useEffect(() => { const controller = new AbortController(); (async () => {
    try { const response = await fetch(`/api/vault/${id}`, { signal: controller.signal, cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); const doc: VaultDocument = result.document; setDocument(doc); setForm(doc.record ?? { ...doc.candidate, total: doc.candidate.total || "", gst: doc.candidate.gst || "", kind: "Expense", category: "Other", treatment: "Needs tax review", currency: "AUD", businessPercent: "100", gstRegistered: false, claimGst: false, notes: "", confirmed: false }); }
    catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not open document."); }
  })(); return () => controller.abort(); }, [id]);
  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => current ? { ...current, [key]: value, ...(key === "kind" || key === "treatment" || key === "gstRegistered" ? { claimGst: false } : {}), ...(key === "kind" && value === "Personal" ? {businessPercent:"0"} : {}) } : current); }
  async function confirm() {
    const parsed = taxRecordSchema.safeParse(form);
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/vault/${id}`, { method: "POST", headers: { "Content-Type": "application/json", "x-invoiceflow-vault": "local" }, body: JSON.stringify(parsed.data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setDocument(result.document); setMessage("Confirmed and saved to your records vault. This document is now included in records and exports."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save record."); }
    finally { setBusy(false); }
  }
  const saved = document?.status === "Confirmed";
  return <AppShell title={saved ? "A record you can trace." : "Your review. Your final say."} subtitle="Compare the source, correct the details, and choose how this record should be organised.">
    <div className={styles.titleRow}><Link href="/upload" className={styles.secondary}>← Document inbox</Link><Link href="/records" className={styles.secondary}>Records vault ↗</Link></div>
    {message && <p className={styles.notice} role="status">{message}</p>}
    {!document || !form ? !message && <p role="status">Opening document…</p> : <>
      <div className={styles.titleRow}><span className={saved ? styles.confirmedBadge : styles.reviewBadge}>{saved ? "Confirmed record" : "Human review required"}</span><span className={styles.tag}>{document.method} · {financialYear(form.issued)} FY</span></div>
      {document.notice && <p className={styles.notice}>{document.notice}</p>}
      <div className={styles.reviewGrid}>
        <section className={`${styles.panel} ${styles.sourcePanel}`} data-glow="true"><div className={styles.titleRow}><h2>{document.source ? "Source workbook" : "Original document"}</h2><a href={`/api/vault/${id}?file=1`} target="_blank" rel="noreferrer" className={styles.textLink}>{document.source ? "Download workbook ↓" : "Open original ↗"}</a></div><p className={styles.muted}>{document.name}</p>{document.mime === "application/pdf" && <label className={styles.muted}>Preview page <select aria-label="Original document page" value={sourcePage} onChange={event => setSourcePage(event.target.value)}>{Array.from({length:document.pages || 1},(_,index) => <option key={index} value={index+1}>Page {index+1}</option>)}</select></label>}{document.source?.kind === "spreadsheet" ? <SpreadsheetSource document={document} /> : <Image className={styles.sourceImage} src={document.mime === "application/pdf" ? `/api/vault/${id}?preview=1&page=${sourcePage}` : `/api/vault/${id}?file=1`} width={1000} height={1400} unoptimized alt={document.mime === "application/pdf" ? `Original invoice page ${sourcePage}` : "Original uploaded invoice"} />}<details className={styles.details}><summary>Extracted text & source fingerprint</summary><p className={styles.hash}>SHA-256 · {document.source?.fileHash || document.hash}</p><pre className={styles.rawText}>{document.text || "No usable text was extracted. Read the original and enter its details."}</pre></details></section>
        <section className={styles.panel} data-glow="true"><h2>{saved ? "Confirmed details" : "Check the suggested details"}</h2><p className={styles.muted}>Suggestions can be incomplete or incorrect. Missing fields stay blank. Amounts and tax are confirmed by you.</p><form onSubmit={event => { event.preventDefault(); void confirm(); }}><fieldset className={styles.fieldset} disabled={saved || busy}>
          <div className={styles.fields}><label>Supplier / customer *<input value={form.supplier} onChange={e => change("supplier", e.target.value)} required maxLength={300} /></label><label>Invoice number *<input value={form.number} onChange={e => change("number", e.target.value)} required maxLength={100} /></label><label>Invoice date *<input type="date" value={form.issued} onChange={e => change("issued", e.target.value)} required /></label><label>Record type<select value={form.kind} onChange={e => change("kind", e.target.value as Form["kind"])}>{["Expense","Income","Personal"].map(kind => <option key={kind}>{kind}</option>)}</select></label><label>Total including GST (AUD) *<input inputMode="decimal" value={form.total} onChange={e => change("total", e.target.value)} required /></label><label>GST shown on document (AUD) *<input inputMode="decimal" value={form.gst} onChange={e => change("gst", e.target.value)} required /></label></div>
          <div className={styles.taxBox}><span className={styles.eyebrow}>AUSTRALIAN TAX ORGANISATION</span><label>Category<select value={form.category} onChange={e => change("category", e.target.value as Form["category"])}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label>GST treatment<select value={form.treatment} onChange={e => change("treatment", e.target.value as Form["treatment"])}>{treatments.map(treatment => <option key={treatment}>{treatment}</option>)}</select></label><label>Business use (%)<input inputMode="decimal" value={form.businessPercent} onChange={e => change("businessPercent", e.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={form.gstRegistered} onChange={e => change("gstRegistered", e.target.checked)} />My business is registered for GST</label><label className={styles.check}><input type="checkbox" checked={form.claimGst} disabled={!form.gstRegistered || form.kind !== "Expense" || form.treatment !== "GST included"} onChange={e => change("claimGst", e.target.checked)} />Include a GST credit estimate for this purchase</label><p className={styles.footnote}>Categories are organisational selections. Capital assets may require separate tax treatment. GST credit estimates use the entered GST and business-use percentage; they are not automatic tax claims. <a href="https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits" target="_blank" rel="noreferrer">ATO guidance ↗</a></p></div>
          <label>Notes<textarea value={form.notes} maxLength={5000} rows={3} onChange={e => change("notes", e.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={form.confirmed} onChange={e => change("confirmed", e.target.checked)} required />I checked the original, amounts, date and tax selections.</label>
        </fieldset><button className={styles.primary} type="submit" disabled={saved || busy}>{saved ? "Saved to records" : busy ? "Saving record…" : "Confirm & save record ↗"}</button></form></section>
      </div>
    </>}
  </AppShell>;
}
