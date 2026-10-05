import { hundredths } from "../domain/invoice-math";
import { taxInputSchema } from "./schemas";
import { annualise, roundRatio } from "./periods";
import { rules2025 } from "./australia/rules/2025-26";
import { rules2026 } from "./australia/rules/2026-27";
import type { TaxResult, TaxRules } from "./types";
export const ruleSets = { "2025-26": rules2025, "2026-27": rules2026 } as const;
const cents = (dollars: number) => dollars * 100;
const rateAmount = (amount: number, basisPoints: number) => roundRatio(BigInt(amount), BigInt(basisPoints), BigInt(10000));
export function calculateMedicare(income: number, rule: TaxRules["medicare"]): number {
  if (income <= cents(rule.threshold)) return 0;
  const full = rateAmount(income, rule.rate);
  return income <= cents(rule.phaseInLimit) ? Math.min(full, rateAmount(income - cents(rule.threshold), rule.phaseInRate)) : full;
}
export function calculateOffset(income: number, rule: TaxRules["lito"]): number {
  if (income <= cents(rule.firstThreshold)) return cents(rule.maximum);
  if (income <= cents(rule.secondThreshold)) return Math.max(0, cents(rule.maximum) - rateAmount(income - cents(rule.firstThreshold), rule.firstTaper));
  if (income <= cents(rule.finalThreshold)) return Math.max(0, cents(rule.secondMaximum) - rateAmount(income - cents(rule.secondThreshold), rule.secondTaper));
  return 0;
}
export function calculateTax(raw: unknown): TaxResult {
  const input = taxInputSchema.parse(raw);
  const rules = ruleSets[input.financialYear];
  const annualGrossCents = annualise(Number(hundredths(input.income, BigInt(10000000))), input.frequency, input);
  if (annualGrossCents > 1000000000) throw new RangeError("Annualised income must be $10,000,000 or less.");
  const brackets = rules.brackets.map(bracket => {
    const lowerCents = cents(bracket.lower), upperCents = bracket.upper === null ? null : cents(bracket.upper);
    const incomeCents = Math.max(0, Math.min(annualGrossCents, upperCents ?? annualGrossCents) - lowerCents);
    return { lowerCents, upperCents, rate: bracket.basisPoints / 100, incomeCents, taxCents: rateAmount(incomeCents, bracket.basisPoints) };
  });
  const taxBeforeOffsetCents = brackets.reduce((sum, bracket) => sum + bracket.taxCents, 0);
  const offsetCents = Math.min(taxBeforeOffsetCents, calculateOffset(annualGrossCents, rules.lito));
  const incomeTaxCents = taxBeforeOffsetCents - offsetCents;
  const medicareCents = calculateMedicare(annualGrossCents, rules.medicare);
  const deductionsCents = incomeTaxCents + medicareCents, netCents = annualGrossCents - deductionsCents;
  const marginalRate = [...brackets].reverse().find(bracket => annualGrossCents > bracket.lowerCents)?.rate ?? 0;
  return { input, annualGrossCents, taxBeforeOffsetCents, offsetCents, incomeTaxCents, medicareCents, deductionsCents, netCents,
    effectiveRate: annualGrossCents ? deductionsCents / annualGrossCents * 100 : 0,
    keepRate: annualGrossCents ? netCents / annualGrossCents * 100 : 0, marginalRate, brackets, rulesVersion: rules.version,
    assumptions: ["Single adult Australian resident for the full year; employee income only.", "Gross income is treated as taxable income; no deductions are applied.", "Standard single Medicare levy including low-income reduction; no exemptions or pensioner concessions.", "Low income tax offset is applied where eligible and capped at income tax.", "HELP/student loans, Medicare levy surcharge, other offsets, salary sacrifice and superannuation are excluded.", "Period results are averages of the annual estimate, not exact PAYG withholding."],
  };
}
export function compareTax(base: TaxResult, other: TaxResult) {
  if (base.input.financialYear !== other.input.financialYear) throw new RangeError("Compare incomes within the same financial year.");
  return { gross: other.annualGrossCents - base.annualGrossCents, deductions: other.deductionsCents - base.deductionsCents, net: other.netCents - base.netCents, rate: other.effectiveRate - base.effectiveRate };
}
