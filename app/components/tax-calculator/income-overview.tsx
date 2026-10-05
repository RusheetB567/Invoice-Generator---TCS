import type { TaxResult, PayPeriod } from "../../../lib/tax/types";
import { periodBreakdown } from "../../../lib/tax/periods";
import { money, percentage, periods, labels, suffixes } from "./presentation";
import styles from "./tax.module.css";
export function Distribution({ result }: { result: TaxResult }) {
  const gross = result.annualGrossCents;
  const tax = gross ? result.incomeTaxCents / gross * 100 : 0, medicare = gross ? result.medicareCents / gross * 100 : 0, net = gross ? result.netCents / gross * 100 : 0;
  return <div className={styles.distribution} role="img" aria-label={`Annual income distribution: take-home ${money(result.netCents)}, income tax ${money(result.incomeTaxCents)}, Medicare ${money(result.medicareCents)}.`}>
    <span className={styles.netSegment} style={{ width: `${net}%` }} /><span className={styles.taxSegment} style={{ width: `${tax}%` }} /><span className={styles.medicareSegment} style={{ width: `${medicare}%` }} />
  </div>;
}
export function Overview({ result, period }: { result: TaxResult; period: PayPeriod }) {
  const amounts = periodBreakdown(result, period, result.input);
  return <section className={`${styles.card} ${styles.hero}`} data-glow="true" aria-label="Income overview">
    <div className={styles.sectionLabel}><span>02 / THE BIGGER PICTURE</span><span className={styles.badge}>AUSTRALIA</span></div>
    <p className={styles.heroLabel}>Your estimated take-home</p>
    <div className={styles.heroAmount}>{money(amounts.net)}</div><p className={styles.heroPeriod}>per {suffixes[period]} <span>· {result.input.financialYear.replace("-", "–")}</span></p>
    <div className={styles.keepPill}><span aria-hidden="true">↗</span> You keep {percentage(result.keepRate)} of your gross income</div>
    <Distribution result={result} />
    <dl className={styles.legend}>
      <div><dt><i className={styles.netDot} />Take-home</dt><dd>{money(amounts.net)}</dd></div>
      <div><dt><i className={styles.taxDot} />Income tax</dt><dd>{money(amounts.tax)}</dd></div>
      <div><dt><i className={styles.medicareDot} />Medicare</dt><dd>{money(amounts.medicare)}</dd></div>
    </dl>
    <div className={styles.heroBottom}><div><span>Effective deductions</span><strong>{percentage(result.effectiveRate)}</strong></div><div><span>Income tax bracket rate</span><strong>{percentage(result.marginalRate)}</strong></div></div>
    <p className={styles.helper}>Bracket rate excludes Medicare and offset changes. Estimates are not an official assessment.</p>
  </section>;
}
export function PeriodSummary({ result, period, onPeriod }: { result: TaxResult; period: PayPeriod; onPeriod: (period: PayPeriod) => void }) {
  const amounts = periodBreakdown(result, period, result.input);
  return <section aria-labelledby="period-heading">
    <div className={styles.periodRow}><h2 id="period-heading">Your income, on your terms</h2><span>View results per {suffixes[period]}</span></div>
    <div className={styles.segments} role="group" aria-label="View results as">{periods.map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => onPeriod(value)}>{labels[value]}</button>)}</div>
    <div className={styles.metrics}>
      {[["Gross income", money(amounts.gross)], ["Income tax", money(amounts.tax)], ["Medicare levy", money(amounts.medicare)], ["Take-home", money(amounts.net)], ["Effective rate", percentage(result.effectiveRate)]].map(([label, value]) => <div className={`${styles.metric} ${label === "Take-home" ? styles.highlight : ""}`} key={label} data-glow="true"><span>{label}</span><strong>{value}</strong><small>{label === "Effective rate" ? "Tax + levy / gross" : `Per ${suffixes[period]}`}</small></div>)}
    </div>
    <p className={styles.helper}>Annual assessment estimates allocated across periods. Fortnightly = 26 payments; semimonthly = 24. Daily/hourly use your work pattern. Rounded components reconcile to the displayed take-home.</p>
  </section>;
}
export function IncomeDistribution({ result }: { result: TaxResult }) {
  const parts = [{ name: "You keep", cents: result.netCents, dot: styles.netDot }, { name: "Income tax", cents: result.incomeTaxCents, dot: styles.taxDot }, { name: "Medicare levy", cents: result.medicareCents, dot: styles.medicareDot }];
  return <section className={styles.card} data-glow="true" aria-labelledby="distribution-heading"><div className={styles.sectionLabel}><span>04 / FOLLOW THE MONEY</span><span>ANNUAL</span></div><h2 id="distribution-heading">Where your income goes</h2><p className={styles.intro}>Every dollar has a destination. Here is the split of {money(result.annualGrossCents)}.</p><Distribution result={result} /><div className={styles.distributionGrid}>{parts.map(part => <div key={part.name}><span><i className={part.dot} />{part.name}</span><strong>{money(part.cents)}</strong><small>{percentage(result.annualGrossCents ? part.cents / result.annualGrossCents * 100 : 0)} of gross income</small></div>)}</div>
    <div className={styles.hundred}><div><h3>For every $100 you earn</h3><p>{result.annualGrossCents ? "A small scale view of the same annual estimate." : "Enter an income above zero to see the $100 breakdown."}</p></div>{parts.map(part => <div key={part.name}><span>{part.name}</span><strong>{result.annualGrossCents ? money(Math.round(part.cents / result.annualGrossCents * 10000)) : "—"}</strong></div>)}</div>
  </section>;
}
