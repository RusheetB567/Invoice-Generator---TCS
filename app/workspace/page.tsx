"use client";

import Link from "next/link";
import AppShell from "../components/app-shell";
import DocumentCard from "../components/document-card";
import { money } from "../components/money";
import { useDrafts, useBrand, useInvoiceSummary } from "../../lib/local-data";
import styles from "../workspace.module.css";

export default function WorkspacePage() {
  const drafts = useDrafts();
  const brand = useBrand();
  const summary = useInvoiceSummary();
  const savedCount = summary.reduce((sum, row) => sum + row.count, 0);
  const countStatus = (status: string) => summary.filter(row => row.status === status).reduce((sum, row) => sum + row.count, 0);
  const currencies = [...new Set(summary.filter(row => row.status !== "Cancelled").map(row => row.currency))];
  const totals = currencies.map(currency => ({ currency, total: summary.filter(row => row.currency === currency && row.status !== "Cancelled").reduce((sum, row) => sum + BigInt(row.totalCents), BigInt(0)) }));
  const stats = [
    { label: "Saved invoices", value: savedCount, glyph: "▤", note: "Saved to your workspace" },
    { label: "Drafts to finish", value: countStatus("Draft"), glyph: "✎", note: "Your next great impression" },
    { label: "Recorded as paid", value: countStatus("Paid"), glyph: "✓", note: "Status recorded by you" },
    { label: "Active currencies", value: currencies.length, glyph: "◎", note: "Totals kept separate" },
  ];
  return <AppShell title="Your business, in focus." subtitle="A clear view of your invoices. A workspace that feels like you.">
    <section className={styles.hero} data-glow="true" aria-label="Create your next invoice">
      <div><span className={styles.eyebrow}>CREATE / COLLECT / UNDERSTAND</span><h2>Great work deserves<br /><em>a clearer picture.</em></h2><p>{brand?.company ? `${brand.company}, create your next invoice or turn received documents into organised records.` : "Create an invoice in your own style, or upload the invoices you receive. Two workflows, one clear workspace."}</p><div className={styles.heroActions}><Link href="/create" className={styles.primary}>Create an invoice <span aria-hidden="true">↗</span></Link><Link href="/upload" className={styles.secondary}>Upload an invoice ↥</Link></div></div>
      <div className={styles.heroOrbit} aria-hidden="true"><div className={styles.orbit} /><div className={styles.orbit} /><div className={styles.orbit} /><div className={styles.orbitalDoc}><strong>{"</>"}</strong><div className={styles.docLine} /><div className={styles.docLine} /><div className={styles.docLine} /><div className={styles.docTotal}>YOUR NEXT / 001</div></div><div className={styles.floatingLabel}><span>✦</span> Built around your brand</div></div>
    </section>
    <section className={styles.stats} aria-label="Saved invoice statistics">{stats.map(stat => <div className={styles.stat} data-glow="true" key={stat.label}><div className={styles.statTop}><span>{stat.label}</span><span className={styles.statGlyph} aria-hidden="true">{stat.glyph}</span></div><p className={styles.statValue}>{stat.value.toString().padStart(2, "0")}</p><div className={styles.statNote}>{stat.note}</div></div>)}</section>
    <div className={styles.dashboardGrid}>
      <section className={styles.panel} data-glow="true" aria-labelledby="recent-heading"><div className={styles.panelHeading}><h2 id="recent-heading" className={styles.panelTitle}>Recent invoices</h2><Link href="/invoices">View all ↗</Link></div>{drafts.length ? <div className={styles.tableWrap} role="region" aria-label="Recent invoices, scroll horizontally to see all columns" tabIndex={0}><table className={styles.table}><thead><tr><th scope="col">INVOICE</th><th scope="col">CUSTOMER</th><th scope="col">STATUS</th><th scope="col" className={styles.numeric}>TOTAL</th></tr></thead><tbody>{drafts.slice(0, 5).map(draft => <tr key={draft.id}><td><span className={styles.invoiceNumber}>{draft.number}</span></td><td>{draft.customer}</td><td><span className={styles.statusBadge}>{draft.status}</span></td><td className={styles.numeric}>{money(draft.totalCents, draft.currency)}</td></tr>)}</tbody></table></div> : <div className={styles.empty}><div className={styles.emptyGlyph} aria-hidden="true">▤</div><h3>Your next chapter starts here.</h3><p>Save your first invoice in the creator. Your real numbers will appear right here.</p><Link href="/create" className={styles.secondary}>+ Create your first invoice</Link></div>}</section>
      <section className={styles.panel} data-glow="true" aria-labelledby="pulse-heading"><div className={styles.panelHeading}><h2 id="pulse-heading" className={styles.panelTitle}>Workspace pulse</h2><span className={styles.eyebrow}>SERVER TOTALS</span></div>{totals.length ? <div className={styles.summarySplit}>{totals.map(total => <div key={total.currency}><span>Saved totals · {total.currency}</span><strong>{money(total.total, total.currency)}</strong></div>)}<p className={styles.statNote}>Excludes cancelled invoices. Saved totals include drafts and are not recognised revenue.</p></div> : <p className={styles.muted}>No financial totals yet. Each currency will be reported separately as you save invoices.</p>}{(["Draft", "Sent", "Paid", "Cancelled"] as const).map(status => { const count = countStatus(status); return <div className={styles.statusRow} key={status}><span aria-hidden="true" /><span>{status}</span><div className={styles.statusTrack} aria-hidden="true"><div className={styles.statusFill} style={{ width: `${savedCount ? count / savedCount * 100 : 0}%` }} /></div><strong>{count.toString().padStart(2, "0")}</strong></div>; })}<div className={styles.quickLinks}><Link className={styles.quickLink} href="/settings"><span aria-hidden="true">✦</span><span><strong>Your brand studio</strong><small>Logo, colours, company details</small></span><span aria-hidden="true">↗</span></Link><Link className={styles.quickLink} href="/reminders"><span aria-hidden="true">◷</span><span><strong>Plan your reminders</strong><small>Configure a future reminder workflow</small></span><span aria-hidden="true">↗</span></Link></div></section>
    </div>
    <DocumentCard />
  </AppShell>;
}
