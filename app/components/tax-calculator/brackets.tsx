import type { TaxResult } from "../../../lib/tax/types";
import { money, shortMoney, percentage } from "./presentation";
import styles from "./tax.module.css";
export default function Brackets({ result }: { result: TaxResult }) {
  const range = (lower: number, upper: number | null) => upper === null ? `Above ${shortMoney(lower)}` : `${lower ? "Above " : ""}${shortMoney(lower)} – ${shortMoney(upper)}`;
  return <section className={styles.card} id="tax-brackets" aria-labelledby="bracket-heading" data-glow="true"><div className={styles.sectionLabel}><span>03 / BRACKET EXPLORER</span><span>{result.input.financialYear.replace("-", "–")}</span></div><h2 id="bracket-heading">Only the slice moves up.</h2><p className={styles.intro}>A higher bracket applies to the income inside it. Your whole salary does not move to a higher rate.</p>
    <div className={styles.bracketBars}>{result.brackets.map((bracket, index) => {
      const capacity = bracket.upperCents === null ? Math.max(10000000, bracket.incomeCents) : bracket.upperCents - bracket.lowerCents;
      const fill = capacity ? bracket.incomeCents / capacity * 100 : 0;
      return <div className={styles.bracket} key={bracket.lowerCents} tabIndex={0} aria-label={`${range(bracket.lowerCents, bracket.upperCents)}, ${bracket.rate}%: ${money(bracket.incomeCents)} income, ${money(bracket.taxCents)} tax before offsets.`}>
        <div className={styles.bracketHeading}><span>{range(bracket.lowerCents, bracket.upperCents)}</span><strong>{bracket.rate}%</strong></div>
        <div className={styles.track}><span style={{ width: `${Math.min(100, fill)}%` }} className={index === 0 ? styles.freeFill : styles.bracketFill} /></div><div className={styles.bracketCaption}><span>{money(bracket.incomeCents)} in this bracket</span><span>{money(bracket.taxCents)} tax</span></div>
        <span className={styles.tooltip}>Rate {bracket.rate}% · Income {money(bracket.incomeCents)} · Tax {money(bracket.taxCents)}</span>
      </div>;
    })}</div>
    <div className={styles.tableScroll}><table><caption>Annual bracket contributions before the low income tax offset</caption><thead><tr><th scope="col">Income slice</th><th scope="col">Rate</th><th scope="col">Your income</th><th scope="col">Tax before offset</th></tr></thead><tbody>{result.brackets.map(bracket => <tr key={bracket.lowerCents}><th scope="row">{range(bracket.lowerCents, bracket.upperCents)}</th><td>{bracket.rate}%</td><td>{money(bracket.incomeCents)}</td><td>{money(bracket.taxCents)}</td></tr>)}</tbody><tfoot><tr><th scope="row" colSpan={3}>Income tax before offset</th><td>{money(result.taxBeforeOffsetCents)}</td></tr><tr><th scope="row" colSpan={3}>Low income tax offset applied</th><td>−{money(result.offsetCents)}</td></tr><tr><th scope="row" colSpan={3}>Estimated income tax</th><td>{money(result.incomeTaxCents)}</td></tr></tfoot></table></div><p className={styles.helper}>Your income tax bracket rate is {percentage(result.marginalRate)}. This is separate from your effective deductions rate and excludes the levy and offset taper.</p>
  </section>;
}
