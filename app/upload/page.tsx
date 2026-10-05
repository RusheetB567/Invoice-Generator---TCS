"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/app-shell";
import { useVault } from "../../lib/use-vault";
import styles from "../vault.module.css";
export default function UploadPage() {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const { documents, loading, error } = useVault();
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setMessage("Choose a PDF, JPG or PNG up to 10 MB."); return; }
    setBusy(true); setMessage("Reading your document locally. Scanned pages can take a little longer.");
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/vault", { method: "POST", headers: { "x-invoiceflow-vault": "local" }, body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/upload/${result.document.id}${result.duplicate ? "?duplicate=1" : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read the file. Please try again."); setBusy(false); }
  }
  return <AppShell title="Paperwork, meet possibility." subtitle="A document inbox for the invoices you receive. Read, review, and keep the original.">
    <div className={styles.titleRow}><span className={styles.tag}>LOCAL RECORDS VAULT / AUSTRALIA</span><Link href="/records" className={styles.secondary}>Open records ↗</Link></div>
    <section className={`${styles.drop} ${dragging ? styles.dragging : ""}`} data-glow="true" aria-label="Invoice upload area" onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) { setMessage("Drop one document at a time so each gets its own review."); return; } void upload(event.dataTransfer.files[0]); }}>
      <div className={styles.paperStack} aria-hidden="true"><span /><span /><span><b>↥</b><i /><i /><i /></span></div>
      <div><span className={styles.eyebrow}>FROM FILE TO FINANCIAL CLARITY</span><h2>{busy ? "Reading the details…" : dragging ? "Drop it. We’ll take a look." : "A little less paperwork."}</h2><p>Drop an invoice here, or choose it from your device.<br />Your original stays with the record.</p><button className={styles.primary} disabled={busy || !!error} onClick={() => input.current?.click()}>{busy ? "Reading document…" : "Choose a document"}</button><input ref={input} className={styles.hidden} type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Choose invoice file" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /><small>PDF / JPG / PNG · 10 MB · English OCR · PDFs up to 20 pages</small></div>
    </section>
    {(message || error) && <p className={styles.notice} role={error || !busy ? "alert" : "status"}>{error || message}</p>}
    <div className={styles.flow}>{[["01", "Read locally", "PDF text first. OCR for images and scans."], ["02", "You have the final say", "Correct suggested fields beside the original."], ["03", "Ready for your records", "Choose tax treatment, confirm, then export."]].map(([step,title,copy]) => <div className={styles.panel} data-glow="true" key={step}><span className={styles.step}>{step}</span><h3>{title}</h3><p>{copy}</p></div>)}</div>
    <section className={styles.panel} data-glow="true"><div className={styles.titleRow}><h2>Your document inbox</h2><span className={styles.tag}>{documents.filter(doc => doc.status === "Review").length} awaiting review</span></div>{loading ? <p role="status">Opening your vault…</p> : !documents.length ? <div className={styles.empty}>Your first upload starts the story. No demo financial records are included.</div> : <div className={styles.inbox}>{documents.slice(0, 8).map(doc => <Link href={`/upload/${doc.id}`} key={doc.id} className={styles.document}><span className={styles.fileIcon}>{doc.mime === "application/pdf" ? "PDF" : "IMG"}</span><span><strong>{doc.name}</strong><small>{doc.method} · Original retained</small></span><span className={doc.status === "Review" ? styles.reviewBadge : styles.confirmedBadge}>{doc.status === "Review" ? "Review details" : "Confirmed"} ↗</span></Link>)}</div>}</section>
    <p className={styles.footnote}>This development vault stores original files and PostgreSQL records on this computer. Invoice reading stays local. Access is limited to your signed-in business. Managed database and file storage are required before cloud hosting.</p>
  </AppShell>;
}

