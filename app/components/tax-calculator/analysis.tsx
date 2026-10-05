import dynamic from "next/dynamic";
import { useState } from "react";
import type { TaxResult, PayPeriod } from "../../../lib/tax/types";
import { PeriodSummary, IncomeDistribution } from "./income-overview";
import { shortMoney } from "./presentation";
import styles from "./tax.module.css";
function LoadingAnalysis() { return <p className={styles.helper} role="status">Opening analysis…</p>; }
const Brackets = dynamic(() => import("./brackets"), { loading: LoadingAnalysis });
const PayRise = dynamic(() => import("./scenarios").then(module => module.PayRise), { loading: LoadingAnalysis });
const Comparison = dynamic(() => import("./scenarios").then(module => module.IncomeComparison), { loading: LoadingAnalysis });
const Converter = dynamic(() => import("./scenarios").then(module => module.SalaryConverter), { loading: LoadingAnalysis });
export type AnalysisTool = "breakdown" | "brackets" | "explore" | "raise" | "compare" | "convert";
const tools: { value: AnalysisTool; label: string }[] = [{ value: "breakdown", label: "Income breakdown" }, { value: "brackets", label: "Tax brackets" }, { value: "explore", label: "Income explorer" }, { value: "raise", label: "Pay-rise simulator" }, { value: "compare", label: "Compare salaries" }, { value: "convert", label: "Hourly / salary converter" }];
export default function AdvancedAnalysis({ result, period, onPeriod, open, onOpen, tool, onTool, onIncome, onCommit }: {
  result: TaxResult; period: PayPeriod; onPeriod: (period: PayPeriod) => void; open: boolean; onOpen: (open: boolean) => void; tool: AnalysisTool; onTool: (tool: AnalysisTool) => void; onIncome: (income: string) => void; onCommit: () => void;
}) {
  const [visited, setVisited] = useState<AnalysisTool[]>([]);
  function remember(value: AnalysisTool) {
    setVisited(previous => previous.includes(value) ? previous : [...previous, value]);
  }
  // Mount a tool only when requested, then retain its edits while switching tools.
  const mounted = open && !visited.includes(tool) ? [...visited, tool] : visited;
  return <details className={styles.analysisDisclosure} open={open} onToggle={event => { remember(tool); onOpen(event.currentTarget.open); }}>
    <summary><div><strong>More analysis</strong><span>Breakdowns, comparisons and salary tools</span></div><span className={styles.disclosureIcon} aria-hidden="true">＋</span></summary>
    {mounted.length > 0 && <div className={styles.analysisBody} hidden={!open}><label className={styles.analysisSelector}>Choose a tool<select value={tool} onChange={event => { const next = event.target.value as AnalysisTool; remember(tool); remember(next); onTool(next); }}>{tools.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {mounted.map(value => <div className={styles.analysisPane} key={value} hidden={tool !== value}>
        {value === "breakdown" && <><PeriodSummary result={result} period={period} onPeriod={onPeriod} /><IncomeDistribution result={result} /></>}
        {value === "brackets" && <Brackets result={result} />}
        {value === "raise" && <PayRise base={result} />}
        {value === "compare" && <Comparison base={result} />}
        {value === "convert" && <Converter base={result} />}
        {value === "explore" && <section className={`${styles.card} ${styles.explorer}`} aria-labelledby="explore-heading"><div><h2 id="explore-heading">Explore annual income</h2><p>Move the slider to update your estimate.</p></div><output htmlFor="income-slider" className={styles.sliderAmount}>{shortMoney(result.annualGrossCents)}</output><label className={styles.sliderLabel} htmlFor="income-slider">Annual gross income</label><input id="income-slider" className={styles.slider} type="range" min="0" max={Math.max(250000, Math.ceil(result.annualGrossCents / 100 / 50000) * 50000)} step="100" value={result.annualGrossCents / 100} onChange={event => onIncome(event.target.value)} onBlur={onCommit} onPointerUp={onCommit} onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) onCommit(); }} aria-valuetext={`${shortMoney(result.annualGrossCents)} annual gross income`} /><div className={styles.sliderEnds}><span>$0</span><span>{shortMoney(Math.max(25000000, Math.ceil(result.annualGrossCents / 5000000) * 5000000))}</span></div></section>}
      </div>)}
    </div>}
  </details>;
}
