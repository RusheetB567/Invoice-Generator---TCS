import { categories, treatments } from "../../../lib/domain/tax-record";
import type { RecordDraft } from "../../../lib/domain/spreadsheet-records";
import styles from "../../vault.module.css";
export default function RecordEditor({ draft, onChange, disabled }: { draft: RecordDraft; onChange: (draft: RecordDraft) => void; disabled: boolean }) {
  function change<K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) {
    onChange({ ...draft, [key]: value, ...(key === "kind" || key === "treatment" || key === "gstRegistered" ? { claimGst: false } : {}), ...(key === "kind" && value === "Personal" ? { businessPercent: "0" } : {}) });
  }
  return <fieldset className={styles.fieldset} disabled={disabled}><div className={styles.fields}>
    <label>Supplier / customer<input maxLength={300} value={draft.supplier} onChange={e => change("supplier", e.target.value)} /></label>
    <label>Invoice number<input maxLength={100} value={draft.number} onChange={e => change("number", e.target.value)} /></label>
    <label>Invoice date<input type="date" value={draft.issued} onChange={e => change("issued", e.target.value)} /></label>
    <label>Record type<select value={draft.kind} onChange={e => change("kind", e.target.value as RecordDraft["kind"])}>{!["Expense","Income","Personal"].includes(draft.kind) && <option value={draft.kind}>{draft.kind} (unsupported)</option>}{["Expense", "Income", "Personal"].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Total including GST<input inputMode="decimal" maxLength={20} value={draft.total} onChange={e => change("total", e.target.value)} /></label>
    <label>GST shown on document<input inputMode="decimal" maxLength={20} value={draft.gst} onChange={e => change("gst", e.target.value)} /></label>
  </div><details className={styles.details}><summary>Tax selections & notes</summary><div className={styles.taxBox}>
    <label>Category<select value={draft.category} onChange={e => change("category", e.target.value as RecordDraft["category"])}>{!categories.includes(draft.category) && <option value={draft.category}>{draft.category} (unsupported)</option>}{categories.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>GST treatment<select value={draft.treatment} onChange={e => change("treatment", e.target.value as RecordDraft["treatment"])}>{!treatments.includes(draft.treatment) && <option value={draft.treatment}>{draft.treatment} (unsupported)</option>}{treatments.map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Business use (%)<input inputMode="decimal" maxLength={6} value={draft.businessPercent} onChange={e => change("businessPercent", e.target.value)} /></label>
    <label>Currency<select value={draft.currency} onChange={e => change("currency", e.target.value as "AUD")}>{draft.currency !== "AUD" && <option value={draft.currency}>{draft.currency} (unsupported)</option>}<option>AUD</option></select></label>
    <label className={styles.check}><input type="checkbox" checked={draft.gstRegistered} onChange={e => change("gstRegistered", e.target.checked)} />My business is GST registered</label>
    <label className={styles.check}><input type="checkbox" checked={draft.claimGst} disabled={!draft.gstRegistered || draft.kind !== "Expense" || draft.treatment !== "GST included"} onChange={e => change("claimGst", e.target.checked)} />Include a GST credit estimate</label>
    <label>Notes<textarea maxLength={5000} rows={3} value={draft.notes} onChange={e => change("notes", e.target.value)} /></label>
  </div></details></fieldset>;
}
