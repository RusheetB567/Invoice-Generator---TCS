import { calculateTax, compareTax } from "../../../lib/tax/calculate";
import { forPeriod } from "../../../lib/tax/periods";
import type { TaxResult } from "../../../lib/tax/types";
import { money, percentage, signedMoney } from "./presentation";
import type { AnalysisTool } from "./analysis";
import styles from "./tax.module.css";
export default function IncomeInsight({ result, index, onExplore }: { result: TaxResult; index: number; onExplore: (tool: AnalysisTool) => void }) {
  let title: string, text: string, tool: AnalysisTool;
  switch (index) {
    case 1: {
      const nextIncome = Math.min(1000000000, result.annualGrossCents + 500000);
      const raised = calculateTax({ ...result.input, frequency: "annual", income: (nextIncome / 100).toFixed(2) });
      const difference = compareTax(result, raised);
      title = "What would a raise change?";
      text = `A ${money(difference.gross)} annual increase changes estimated take-home by ${signedMoney(difference.net)} under the same assumptions.`;
      tool = "raise"; break;
    }
    case 2:
      title = "See your year as a month";
      text = `Your current take-home estimate averages ${money(forPeriod(result.netCents, "monthly", result.input))} per month. Explore the other pay periods when you need them.`;
      tool = "breakdown"; break;
    case 3:
      title = "A higher bracket taxes one slice";
      text = `Your highest occupied income tax bracket is ${percentage(result.marginalRate)}. Open the breakdown to see which slices contribute to your estimate.`;
      tool = "brackets"; break;
    case 4:
      title = "Put an hourly value on your salary";
      text = `At ${result.input.hoursPerWeek} hours over ${result.input.weeksPerYear} weeks, your annual gross income averages ${money(forPeriod(result.annualGrossCents, "hourly", result.input))} per working hour.`;
      tool = "convert"; break;
    default:
      title = "A smaller view of your income";
      text = result.annualGrossCents ? `For every $100 of gross income, you keep about ${money(Math.round(result.keepRate * 100))} under your current assumptions.` : "Enter an income above zero to explore how much of each $100 you keep.";
      tool = "breakdown";
  }
  return <aside className={styles.insight} aria-label="One income insight"><div><span className={styles.kicker}>ONE THING TO EXPLORE</span><h2>{title}</h2><p>{text}</p></div><button type="button" onClick={() => onExplore(tool)}>Explore <span aria-hidden="true">↗</span></button></aside>;
}
