"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppShell from "../../../components/app-shell";
import RecordEditor from "../../../components/records/record-editor";
import { draftFromRow, draftIssues, fieldLabels, importFields, matchColumns, recordKey, type ColumnMapping, type RecordDraft, type SpreadsheetBatch } from "../../../../lib/domain/spreadsheet-records";
import { useVault } from "../../../../lib/use-vault";
import styles from "../../../vault.module.css";
export default function ReviewSpreadsheet() {
  const { id } = useParams<{ id: string }>(), { documents, loading, error } = useVault();
  const [batch, setBatch] = useState<SpreadsheetBatch | null>(null), [sheetName, setSheetName] = useState(""), [mapping, setMapping] = useState<ColumnMapping | null>(null), [drafts, setDrafts] = useState<Record<number, RecordDraft>>({});
  const [reviewing, setReviewing] = useState(false), [current, setCurrent] = useState(0), [excluded, setExcluded] = useState<number[]>([]), [reviewed, setReviewed] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { const controller = new AbortController(); fetch(`/api/vault/imports/${id}`, { cache: "no-store", signal: controller.signal }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result.batch as SpreadsheetBatch; }).then(value => { if (!controller.signal.aborted) { setBatch(value); setSheetName(value.sheets[0].name); setMapping(matchColumns(value.sheets[0].headers)); } }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not open import."); }); return () => controller.abort(); }, [id]);
  const sheet = batch?.sheets.find(value => value.name === sheetName);
  const rows = useMemo(() => {
    if (!sheet || !batch) return [];
    const keys = new Set(documents.flatMap(doc => doc.record ? [recordKey(doc.record)] : []));
    return sheet.rows.map(source => {
      const draft = drafts[source.number]; if (!draft) return { number: source.number, draft: null, issues: [], duplicate: false, saved: false, include: false };
      const issues = draftIssues(draft), key = recordKey(draft), saved = Boolean(batch.committedRows[`${sheet.name}:${source.number}`]), duplicate = keys.has(key);
      const include = !issues.length && !duplicate && !saved && !excluded.includes(source.number);
      if (include) keys.add(key);
      return { number: source.number, draft, issues, duplicate, saved, include };
    });
  }, [sheet, batch, documents, drafts, excluded]);
  const active = rows[current], ready = rows.filter(row => row.include), remaining = rows.filter(row => !row.saved);
  function beginReview() { if (!sheet || !mapping) return; setDrafts(Object.fromEntries(sheet.rows.map(row => [row.number, draftFromRow(row, mapping)]))); setCurrent(0); setExcluded([]); setReviewed(false); setReviewing(true); setMessage(""); }
  function chooseSheet(name: string) { const chosen = batch!.sheets.find(value => value.name === name)!; setSheetName(name); setMapping(matchColumns(chosen.headers)); setReviewed(false); }
  async function save() {
    if (!reviewed || !ready.length || busy || !sheet) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/vault/imports/${id}`, { method: "POST", headers: { "Content-Type": "application/json", "x-invoiceflow-vault": "local" }, body: JSON.stringify({ sheet: sheet.name, reviewed: true, rows: ready.map(row => ({ number: row.number, record: { ...row.draft!, confirmed: true } })) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setBatch(result.batch); setReviewed(false); setMessage(`${result.saved} records saved. ${result.duplicates} duplicates skipped. Existing records were kept.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the import."); } finally { setBusy(false); }
  }
  return <AppShell title={reviewing ? "Review, then make it yours." : "Match your invoice columns."} subtitle={batch ? `${batch.name} · the original workbook is retained` : "Opening the workbook review…"}>
    <div className={styles.titleRow}><Link className={styles.textLink} href="/records">← Invoice records</Link><Link className={styles.secondary} href="/records/import">Import another workbook</Link></div>
    {(message || error) && <p className={styles.notice} role="status">{message || error}</p>}
    {!batch || !sheet || !mapping ? <p role="status">{message ? "Return to imports to choose another workbook." : "Loading workbook…"}</p> : !reviewing ? <section className={styles.panel} data-glow="true">
      <div className={styles.titleRow}><div><h2>{sheet.rows.length} rows found</h2><p className={styles.muted}>Check the matches, then review your records.</p></div><label className={styles.compactField}>Worksheet<select value={sheetName} onChange={e => chooseSheet(e.target.value)}>{batch.sheets.map(value => <option key={value.name}>{value.name}</option>)}</select></label></div>
      <div className={styles.matchSummary}>{importFields.slice(0, 5).map(field => <div key={field}><span>{fieldLabels[field]}</span><strong>{mapping[field] === null ? "Choose a column" : sheet.headers[mapping[field]!]}</strong></div>)}</div>
      <details className={styles.details} open={importFields.slice(0, 5).some(field => mapping[field] === null)}><summary>Change column matches</summary><div className={`${styles.fields} ${styles.mappingFields}`}>{importFields.map(field => <label key={field}>{fieldLabels[field]}<select value={mapping[field] ?? ""} onChange={e => setMapping({ ...mapping, [field]: e.target.value === "" ? null : Number(e.target.value) })}><option value="">Not supplied — review manually</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}</select></label>)}</div></details>
      <p className={styles.footnote}>Blank GST stays blank. Formula cells are ignored. Business use starts at 0% when absent; GST credit estimates stay off until you select them.</p><button className={styles.primary} onClick={beginReview}>Review rows →</button>
    </section> : <>
      <div className={styles.importCounts}><span><strong>{ready.length}</strong> ready to save</span><span><strong>{remaining.filter(row => row.issues.length).length}</strong> need correction</span><span><strong>{remaining.filter(row => row.duplicate).length}</strong> duplicates</span><span><strong>{rows.filter(row => row.saved).length}</strong> already saved</span></div>
      {!!active?.draft && <section className={styles.panel} data-glow="true"><div className={styles.titleRow}><label className={styles.compactField}>Review a row<select value={current} onChange={e => setCurrent(Number(e.target.value))}>{rows.map((row, index) => <option key={row.number} value={index}>Row {row.number} · {row.draft?.number || "Missing invoice number"} · {row.saved ? "saved" : row.duplicate ? "duplicate" : row.issues.length ? "needs correction" : row.include ? "ready" : "excluded"}</option>)}</select></label><div className={styles.actions}><button className={styles.secondary} disabled={current === 0 || busy} onClick={() => setCurrent(value => value - 1)}>← Previous</button><button className={styles.secondary} disabled={current === rows.length - 1 || busy} onClick={() => setCurrent(value => value + 1)}>Next →</button></div></div>
        {active.issues.length > 0 && <div className={styles.notice} role="alert"><ul>{active.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
        {active.duplicate && !active.saved && <p className={styles.notice}>This supplier/customer, invoice number, date and type already exist. It will be skipped.</p>}
        <RecordEditor draft={active.draft} disabled={busy || active.saved} onChange={draft => { setDrafts(value => ({ ...value, [active.number]: draft })); setReviewed(false); }} />
        <label className={styles.check}><input type="checkbox" checked={active.include} disabled={busy || active.saved || active.duplicate || !!active.issues.length} onChange={e => { setExcluded(value => e.target.checked ? value.filter(number => number !== active.number) : [...value, active.number]); setReviewed(false); }} />Include this row when saving</label>
      </section>}
      <section className={styles.panel}><h2>Save the records you reviewed.</h2><p className={styles.muted}>Only the {ready.length} ready, included rows will be saved. Corrections can be saved in a later pass; duplicates never overwrite records.</p><label className={styles.check}><input type="checkbox" checked={reviewed} disabled={busy || loading || !!error || !ready.length} onChange={e => setReviewed(e.target.checked)} />I reviewed the included rows, amounts and tax selections.</label><div className={styles.actions}><button className={styles.primary} disabled={!reviewed || !ready.length || busy || loading || !!error} onClick={save}>{busy ? "Saving records…" : `Confirm & save ${ready.length} records`}</button><Link className={styles.secondary} href="/records">View invoice records</Link></div></section>
      <details className={styles.details}><summary>Column matching & source details</summary><p className={styles.footnote}>Sheet: {sheet.name} · SHA-256: <span className={styles.hash}>{batch.hash}</span></p><button disabled={busy} className={styles.secondary} onClick={() => { setReviewing(false); setDrafts({}); setReviewed(false); }}>Restart column matching · discard unsaved edits</button></details>
    </>}
  </AppShell>;
}
