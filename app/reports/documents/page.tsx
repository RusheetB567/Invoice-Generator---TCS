"use client";
import Link from "next/link";
import { useState } from "react";
import AppShell from "../../components/app-shell";
import ReportTabs from "../../components/report-tabs";
import { useVault } from "../../../lib/use-vault";
import styles from "../../vault.module.css";
export default function DocumentsPage() {
  const { documents, loading, error } = useVault(), [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = documents.filter(doc => (!status || doc.status === status) && (!needle || [doc.name, doc.record?.supplier, doc.record?.number].some(value => value?.toLowerCase().includes(needle))));
  return <AppShell title="Your documents, together." subtitle="Originals and reviewed sources, beside your reports.">
    <ReportTabs selected="documents" />
    <section className={styles.panel} data-glow="true">
      <div className={styles.titleRow}><div><h2>Document library</h2><span className={styles.muted}>{documents.length} sources in your business workspace</span></div><Link className={styles.secondary} href="/upload">Upload a document ↥</Link></div>
      <div className={`${styles.filters} ${styles.simpleFilters}`}><label>Search documents<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filename, supplier or invoice number" /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All documents</option><option value="Review">Awaiting review</option><option value="Confirmed">Confirmed</option></select></label></div>
      {error ? <p role="alert" className={styles.notice}>{error}</p> : loading ? <p role="status">Opening your document library…</p> : !shown.length ? <div className={styles.empty}><h3>{documents.length ? "No matching documents." : "Keep your first source here."}</h3><p>{documents.length ? "Try another search or status." : "Upload an invoice or import Excel records. Their originals stay with your records."}</p></div> : <div className={styles.inbox}>{shown.map(doc => <Link href={`/upload/${doc.id}`} className={styles.document} key={doc.id}><span className={styles.fileIcon}>{doc.source ? "XLSX" : doc.mime === "application/pdf" ? "PDF" : "IMG"}</span><span><strong>{doc.name}</strong><small>{doc.source ? `${doc.source.sheet} · row ${doc.source.row}` : doc.method}{doc.record ? ` · ${doc.record.number}` : ""}</small></span><span className={doc.status === "Review" ? styles.reviewBadge : styles.confirmedBadge}>{doc.status === "Review" ? "Review" : "Confirmed"} ↗</span></Link>)}</div>}
    </section>
  </AppShell>;
}
