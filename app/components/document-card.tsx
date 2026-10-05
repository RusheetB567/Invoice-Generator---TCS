"use client";
import Link from "next/link";
import { useVault } from "../../lib/use-vault";
import styles from "../workspace.module.css";
export default function DocumentCard() {
  const { documents, loading, error } = useVault();
  const sources = new Set(documents.map(doc => doc.source?.batchId || doc.id)).size;
  return <section className={`${styles.panel} ${styles.documentCard}`} data-glow="true" aria-labelledby="dashboard-documents">
    <div><span className={styles.eyebrow}>TAX / REPORTS</span><h2 id="dashboard-documents">Documents</h2><p>Your originals, alongside your reports.</p></div>
    <div className={styles.documentCardAction}><span className={styles.muted}>{loading ? "Opening your library…" : error ? "Open the library to check your records." : `${sources} original${sources === 1 ? "" : "s"} retained`}</span><Link href="/reports/documents" target="_blank" rel="noopener noreferrer" className={styles.secondary}>Open document library <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></Link></div>
  </section>;
}
