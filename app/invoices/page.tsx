"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "../components/app-shell";
import { money, dateLabel } from "../components/money";
import { useDrafts, deleteDraft, saveDraft, type Draft } from "../../lib/local-data";
import styles from "../workspace.module.css";

export default function InvoicesPage() {
  const drafts = useDrafts();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [removed, setRemoved] = useState<Draft | null>(null);
  const visible = drafts.filter(draft => (`${draft.number} ${draft.customer} ${draft.company}`).toLowerCase().includes(query.toLowerCase()) && (status === "all" || draft.status === status) && (currency === "all" || draft.currency === currency));
  const currencies = [...new Set(drafts.map(draft => draft.currency))];
  const notifyError = (error: unknown) => { setError(true); setMessage(error instanceof Error ? error.message : "Could not update the saved invoice."); };
  const remove = (draft: Draft) => { if (!window.confirm(`Delete invoice ${draft.number} for ${draft.customer} from this browser? You can undo the latest deletion on this page.`)) return; try { deleteDraft(draft.id); setRemoved(draft); setError(false); setMessage(`Invoice ${draft.number} deleted.`); } catch (error) { notifyError(error); } };
  const undo = () => { if (!removed) return; try { saveDraft(removed); setMessage(`Invoice ${removed.number} restored.`); setError(false); setRemoved(null); } catch (error) { notifyError(error); } };
  const changeStatus = (draft: Draft, next: Draft["status"]) => { try { saveDraft({ ...draft, status: next, updatedAt: new Date().toISOString() }); setError(false); setMessage(`Invoice ${draft.number} recorded as ${next.toLowerCase()}.`); } catch (error) { notifyError(error); } };
  return <AppShell title="Every invoice. One place." subtitle="Find your saved work, record its status, and return to the creator.">
    <div className={styles.notice}><span aria-hidden="true">◈</span><span>Invoices are stored on this browser. Status changes record your own activity; they do not send invoices or collect payments.</span></div>
    <section className={styles.panel} data-glow="true" aria-labelledby="invoice-list-heading">
      <div className={styles.panelHeading}><h2 className={styles.panelTitle} id="invoice-list-heading">Invoice library <span className={styles.eyebrow}> / {drafts.length.toString().padStart(2, "0")}</span></h2><Link href="/create" className={styles.primary}>+ New invoice</Link></div>
      <div className={styles.toolbar}><label className={styles.search}><span className={styles.screenreader}>Search customer, invoice number, or company</span><input className={styles.input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search customer, invoice or company…" /></label><label className={styles.filter}><span className={styles.screenreader}>Filter by status</span><select className={styles.select} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{["Draft", "Sent", "Paid", "Cancelled"].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className={styles.filter}><span className={styles.screenreader}>Filter by currency</span><select className={styles.select} value={currency} onChange={event => setCurrency(event.target.value)}><option value="all">All currencies</option>{currencies.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
      {visible.length ? <div className={styles.tableWrap} role="region" aria-label="Saved invoices, scroll horizontally to see all columns" tabIndex={0}><table className={[styles.table, styles.tableWide].join(" ")}><thead><tr><th scope="col">INVOICE</th><th scope="col">CUSTOMER</th><th scope="col">DUE DATE</th><th scope="col" className={styles.numeric}>TOTAL</th><th scope="col">RECORDED STATUS</th><th scope="col">ACTIONS</th></tr></thead><tbody>{visible.map(draft => <tr key={draft.id}><td><span className={styles.invoiceNumber}>{draft.number}</span><small className={styles.statNote} style={{ display: "block", marginTop: "6px" }}>{dateLabel(draft.issued)}</small></td><td>{draft.customer}<small className={styles.statNote} style={{ display: "block", marginTop: "6px" }}>{draft.company}</small></td><td>{dateLabel(draft.due)}</td><td className={styles.numeric}>{money(draft.totalCents, draft.currency)}</td><td><div className={styles.rowAction}><label><span className={styles.screenreader}>Status for invoice {draft.number}</span><select value={draft.status} onChange={event => changeStatus(draft, event.target.value as Draft["status"])}>{["Draft", "Sent", "Paid", "Cancelled"].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></td><td><div className={styles.rowAction}><Link href={`/create?draft=${encodeURIComponent(draft.id)}`}>Edit invoice ↗</Link><button type="button" className={styles.remove} onClick={() => remove(draft)} aria-label={`Delete invoice ${draft.number}`}>Delete</button></div></td></tr>)}</tbody></table></div> : <div className={styles.empty}><div className={styles.emptyGlyph} aria-hidden="true">▤</div><h3>{drafts.length ? "No invoices match those filters." : "A blank canvas for your business."}</h3><p>{drafts.length ? "Try a different customer, invoice number or status." : "Create an invoice and save a local draft. It will appear here, ready to pick up again."}</p>{drafts.length ? <button type="button" className={styles.secondary} onClick={() => { setQuery(""); setStatus("all"); setCurrency("all"); }}>Clear filters</button> : <Link href="/create" className={styles.secondary}>Create your first invoice ↗</Link>}</div>}
      <p className={styles.tableHint}>{visible.length} of {drafts.length} saved invoices shown. Choose Edit invoice to open a saved record in the creator.</p>
      {message && <div className={styles.saveRow}><p className={`${styles.message} ${error ? styles.error : ""}`} role="status">{message}</p>{removed && <button type="button" className={styles.secondary} onClick={undo}>Undo deletion</button>}</div>}
    </section>
  </AppShell>;
}
