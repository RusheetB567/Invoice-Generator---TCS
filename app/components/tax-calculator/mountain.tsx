import { useId } from "react";
import type { TaxResult, PayPeriod } from "../../../lib/tax/types";
import { periodBreakdown } from "../../../lib/tax/periods";
import { labels, money, periods, suffixes } from "./presentation";
import styles from "./tax.module.css";
export default function IncomeMountain({ result, period, onPeriod }: { result: TaxResult; period: PayPeriod; onPeriod: (period: PayPeriod) => void }) {
  const id = useId().replace(/:/g, "");
  const amounts = periodBreakdown(result, period, result.input);
  const incomeHeight = 165 * Math.sqrt(Math.min(result.annualGrossCents / 25000000, 1));
  const taxDepth = result.annualGrossCents ? 150 * Math.sqrt(result.deductionsCents / result.annualGrossCents) : 0;
  return <section className={`${styles.card} ${styles.mountainCard}`} data-glow="true" aria-label="Income overview">
    <div className={styles.mountainHeader}><span className={styles.kicker}>YOUR ESTIMATED TAKE-HOME</span><label className={styles.resultPeriod}><span className={styles.srOnly}>View results as</span><select value={period} onChange={event => onPeriod(event.target.value as PayPeriod)}>{periods.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label></div>
    <div className={styles.heroAmount}>{money(amounts.net)}</div><p className={styles.heroPeriod}>per {suffixes[period]}</p>
    <div className={styles.terrain} role="img" aria-label={`Annual income landscape: gross income ${money(result.annualGrossCents)} above ground. Income tax ${money(result.incomeTaxCents)} plus Medicare ${money(result.medicareCents)}, totalling ${money(result.deductionsCents)}, below ground. Take-home ${money(result.netCents)}.`}>
      <div className={styles.terrainSky} />
      <span className={styles.terrainWind} aria-hidden="true" />
      <div className={styles.terrainAbove} style={{ height: `${incomeHeight}px` }} aria-hidden="true">
        <svg viewBox="0 0 600 220" preserveAspectRatio="none"><defs><linearGradient id={`${id}-summit`} x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#b9eddb" /><stop offset="1" stopColor="#356c63" /></linearGradient></defs><path d="M0 220 124 151 222 93 298 0 465 146 600 220Z" fill={`url(#${id}-summit)`} /><path d="m298 0 6 220H0l124-69 98-58Z" fill="#72ae9c" opacity=".5" /><path d="m298 0 56 74-41-17-28 23-28-31Z" fill="#e1f7ec" opacity=".88" /><path d="m298 0 80 135 87 11 135 74H304Z" fill="#214f4d" opacity=".42" /><path d="m222 93 53 83 29 44H87Z" fill="#92d5bc" opacity=".28" /></svg>
      </div>
      <div className={styles.terrainEarth} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.terrainBelow} style={{ height: `${taxDepth}px` }} aria-hidden="true"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><defs><linearGradient id={`${id}-depth`} x2="0" y2="1"><stop stopColor="#bd8bf7" /><stop offset="1" stopColor="#56316e" /></linearGradient></defs><path d="M0 0h600L445 62 302 200 138 69Z" fill={`url(#${id}-depth)`} /><path d="M0 0h304l-2 200-164-131Z" fill="#d3acf9" opacity=".24" /><path d="m304 0 141 62-143 138Z" fill="#472557" opacity=".6" /></svg></div>
      <div className={styles.terrainGround} aria-hidden="true" />
      <div className={styles.grossAnnotation}><span>Total annual income</span><strong>{money(result.annualGrossCents)}</strong></div>
      <div className={styles.taxAnnotation}><span>Annual tax + Medicare</span><strong>{money(result.deductionsCents)}</strong></div>
    </div>
    <dl className={styles.mountainLegend}><div><dt>Income tax</dt><dd>{money(amounts.tax)}</dd></div><div><dt>Medicare</dt><dd>{money(amounts.medicare)}</dd></div></dl>
    <span className={styles.terrainCaption}>Illustrative landscape · figures update with your income</span>
  </section>;
}
