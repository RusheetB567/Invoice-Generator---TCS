import { useState, type FormEvent } from "react";
import type { TaxInput } from "../../../lib/tax/types";
import { ruleSets } from "../../../lib/tax/calculate";
import { labels, periods } from "./presentation";
import styles from "./tax.module.css";
export default function InputPanel({ input, update, onCalculate, onCommit, pending, error, verification }: {
  input: TaxInput; update: (change: Partial<TaxInput>) => void; onCalculate: () => void; onCommit: () => void;
  pending: boolean; error: string; verification: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const workError = Boolean(error) && !error.startsWith("Gross income:") && !error.startsWith("Annualised");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); onCalculate(); }
  return <form className={`${styles.card} ${styles.simpleInput}`} onSubmit={submit} data-glow="true" aria-label="Tax calculator inputs">
    <div className={styles.sectionLabel}><span>YOUR INCOME</span><span>AUD</span></div>
    <label className={styles.label} htmlFor="tax-income">Gross income</label>
    <div className={styles.currencyField}><span aria-hidden="true">$</span><input id="tax-income" name="income" inputMode="decimal" type="text" maxLength={15} value={input.income} onChange={event => update({ income: event.target.value })} onBlur={onCommit} aria-invalid={Boolean(error) && !workError} aria-describedby={error && !workError ? "tax-input-error" : undefined} /></div>
    <div className={`${styles.fields} ${styles.singleColumn}`}><label>Income frequency<select value={input.frequency} onChange={event => { const frequency = event.target.value as TaxInput["frequency"]; update({ frequency }); if (frequency === "hourly" || frequency === "daily") setSettingsOpen(true); }}>{periods.map(period => <option key={period} value={period}>{labels[period]}</option>)}</select></label></div>
    <details className={styles.advanced} open={settingsOpen || workError} onToggle={event => setSettingsOpen(event.currentTarget.open)}>
      <summary>Calculation settings <span aria-hidden="true">＋</span></summary>
      <div className={styles.settingsBody}>
        <div className={styles.fields}>
          <label>Financial year<select value={input.financialYear} onChange={event => update({ financialYear: event.target.value as TaxInput["financialYear"] })}>{Object.keys(ruleSets).map(year => <option key={year} value={year}>{year.replace("-", "–")}{year === "2026-27" ? " · current law" : ""}</option>)}</select></label>
          <label>Hours / week<input type="number" min="1" max="100" step="0.5" value={input.hoursPerWeek} onChange={event => update({ hoursPerWeek: Number(event.target.value) })} aria-describedby={workError ? "tax-input-error" : undefined} /></label>
          <label>Weeks / year<input type="number" min="1" max="52" step="1" value={input.weeksPerYear} onChange={event => update({ weeksPerYear: Number(event.target.value) })} /></label>
          <label>Days / week<input type="number" min="1" max="7" step="1" value={input.daysPerWeek} onChange={event => update({ daysPerWeek: Number(event.target.value) })} /></label>
        </div>
        <p className={styles.helper}>For single adult, full-year Australian resident employees. Gross pay excludes super. Daily/hourly conversions use your work pattern; weekly results average 52 weeks.</p>
        <p className={styles.helper}>Income tax and the standard single Medicare levy are included. Student loans, Medicare surcharge, deductions and other concessions are excluded.</p>
      </div>
    </details>
    {error && <p id="tax-input-error" className={styles.error} role="alert">{error}</p>}
    <button className={styles.primary} type="submit" disabled={pending || Boolean(error)}>{pending ? "Calculating…" : "Calculate tax"}<span aria-hidden="true">↗</span></button>
    {verification && <p className={styles.helper} role="status">{verification}</p>}
  </form>;
}
