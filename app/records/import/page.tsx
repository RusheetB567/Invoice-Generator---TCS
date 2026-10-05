"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import AppShell from "../../components/app-shell";
import { downloadWorkbook } from "../../../lib/download-workbook";
import styles from "../../vault.module.css";
export default function ImportRecords() {
  const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [dragging, setDragging] = useState(false);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024 || !file.size) { setMessage("Choose an .xlsx workbook up to 5 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/vault/imports?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "x-invoiceflow-vault": "local" }, body: file });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      router.push(`/records/import/${result.batch.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read the workbook."); setBusy(false); }
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) setMessage("Choose one workbook at a time."); else void upload(event.dataTransfer.files[0]); }
  async function template() { try { await downloadWorkbook("/api/vault/template", "TCS-InvoiceFlow-import-template.xlsx"); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not download the template."); } }
  return <AppShell title="Bring your records together." subtitle="Import an Excel workbook, check its rows, then save the records you approve.">
    <div className={styles.titleRow}><Link className={styles.textLink} href="/records">← Invoice records</Link><button className={styles.secondary} onClick={template} disabled={busy}>Download template ↓</button></div>
    {message && <p className={styles.notice} role="alert">{message}</p>}
    <section className={`${styles.drop} ${dragging ? styles.dragging : ""}`} data-glow="true" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} aria-busy={busy}>
      <div><span className={styles.eyebrow}>EXCEL IMPORT</span><h2>{busy ? "Reading your workbook…" : "Drop a workbook here."}</h2><p>Up to 1,000 rows per sheet · .xlsx · 5 MB</p><label className={styles.primary}>Choose Excel file<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} className={styles.fileInput} /></label></div>
    </section>
    <div className={styles.flow}>{[["01", "Match columns", "Recognised headers are matched for you."], ["02", "Review the records", "Correct amounts and choose tax selections."], ["03", "Confirm & save", "Keep the workbook and export your reviewed records."]].map(([step, title, description]) => <section className={styles.panel} key={step}><span className={styles.eyebrow}>{step}</span><h3>{title}</h3><p className={styles.muted}>{description}</p></section>)}</div>
    <details className={styles.details}><summary>Supported data & evidence</summary><p className={styles.footnote}>Use plain values. Formula results are ignored; GST credits are not automatically selected. The imported workbook stays with the records, alongside its sheet and row references. Keep the underlying invoice or receipt evidence separately.</p></details>
  </AppShell>;
}
