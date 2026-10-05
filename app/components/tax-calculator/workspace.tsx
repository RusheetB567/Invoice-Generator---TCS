"use client";
import { useEffect, useRef, useState } from "react";
import { calculateTax, ruleSets } from "../../../lib/tax/calculate";
import { taxInputSchema } from "../../../lib/tax/schemas";
import type { TaxInput, PayPeriod } from "../../../lib/tax/types";
import InputPanel from "./input-panel";
import IncomeMountain from "./mountain";
import AdvancedAnalysis, { type AnalysisTool } from "./analysis";
import IncomeInsight from "./insight";
import { useTaxEngagement } from "./use-engagement";
import styles from "./tax.module.css";
const initial: TaxInput = { income: "80000", frequency: "annual", financialYear: "2026-27", employment: "employee", residency: "resident", hoursPerWeek: 38, weeksPerYear: 52, daysPerWeek: 5 };
function evaluate(input: TaxInput) {
    const validation = taxInputSchema.safeParse(input);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const names: Record<string, string> = { income: "Gross income", hoursPerWeek: "Hours per week", weeksPerYear: "Weeks per year", daysPerWeek: "Days per week" };
      return { result: null, error: `${names[String(issue.path[0])] || "Input"}: ${issue.message}` };
    }
    try { return { result: calculateTax(validation.data), error: "" }; }
    catch { return { result: null, error: "Annualised income must be $10,000,000 or less." }; }
}
export default function TaxWorkspace() {
  const [entry, setEntry] = useState(() => ({ input: initial, computed: evaluate(initial), lastValidResult: calculateTax(initial) }));
  const { input, computed, lastValidResult } = entry;
  const [period, setPeriod] = useState<PayPeriod>("annual");
  const [analysisOpen, setAnalysisOpen] = useState(false), [tool, setTool] = useState<AnalysisTool>("breakdown");
  const [check, setCheck] = useState({ key: "", state: "idle", message: "" });
  const { insight, recordEntry } = useTaxEngagement();
  const request = useRef<AbortController | null>(null), dirtyIncome = useRef(false), lastEntry = useRef<number | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const key = JSON.stringify(input);
  function update(change: Partial<TaxInput>) {
    request.current?.abort();
    if (change.income !== undefined) dirtyIncome.current = true;
    if (change.frequency) setPeriod(change.frequency);
    setEntry(previous => {
      const next = { ...previous.input, ...change }, computed = evaluate(next);
      return { input: next, computed, lastValidResult: computed.result ?? previous.lastValidResult };
    });
  }
  function commitIncome() {
    if (!dirtyIncome.current || !computed.result) return;
    dirtyIncome.current = false;
    const annual = computed.result.annualGrossCents;
    // A blur followed by Calculate must count as one deliberate entry, not two.
    if (lastEntry.current === annual) return;
    lastEntry.current = annual;
    recordEntry();
  }
  async function verify() {
    if (!computed.result) return;
    commitIncome();
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setCheck({ key, state: "pending", message: "" });
    try {
      const response = await fetch("/api/tax/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? "Your session ended. Sign in again to calculate." : "Unable to check this calculation. Please try again.");
      const data = await response.json();
      if (JSON.stringify(data.result) !== JSON.stringify(computed.result)) throw new Error("Calculation rules changed. Refresh this page before continuing.");
      if (!controller.signal.aborted) setCheck({ key, state: "verified", message: "Calculation updated." });
    } catch (error) { if (!controller.signal.aborted) setCheck({ key, state: "error", message: error instanceof Error ? error.message : "Unable to check the calculation. Try again." }); }
  }
  function explore(nextTool: AnalysisTool) { setTool(nextTool); setAnalysisOpen(true); }
  const result = computed.result, rules = ruleSets[input.financialYear];
  return <div className={styles.workspace}>
    <div className={styles.contextRow}><span className={styles.badge}>AUSTRALIA · {input.financialYear.replace("-", "–")}</span><span className={styles.helper}>Resident employee estimate</span></div>
    <div className={`${styles.topGrid} ${styles.simpleGrid}`}><InputPanel input={input} update={update} onCalculate={verify} onCommit={commitIncome} pending={check.key === key && check.state === "pending"} error={computed.error} verification={check.key === key ? check.message : ""} />{result ? <IncomeMountain result={result} period={period} onPeriod={setPeriod} /> : <section className={`${styles.card} ${styles.empty}`}><h2>Let’s get your numbers right.</h2><p>Check your income and calculation settings to see your estimate.</p></section>}</div>
    <div className={styles.analysisStack} hidden={!result}>{insight !== null && <IncomeInsight result={lastValidResult} index={insight} onExplore={explore} />}<AdvancedAnalysis result={lastValidResult} period={period} onPeriod={setPeriod} open={analysisOpen} onOpen={setAnalysisOpen} tool={tool} onTool={setTool} onIncome={income => update({ income, frequency: "annual" })} onCommit={commitIncome} /></div>
    <div className={styles.estimateNote}><span>Estimate only · includes income tax + Medicare</span><details className={styles.sourceDisclosure}><summary>Assumptions & sources</summary><div><p>{rules.note}</p><ul>{(result?.assumptions ?? calculateTax(initial).assumptions).map(item => <li key={item}>{item}</li>)}</ul><p>Amounts are rounded to cents. No work-expense or standard deduction is claimed. These figures are not an official assessment or exact PAYG withholding.</p><ul>{rules.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul><p>Rules {rules.version} · Verified {rules.verifiedAt}</p></div></details></div>
  </div>;
}
