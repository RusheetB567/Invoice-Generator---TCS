export const periods = ["annual", "monthly", "fortnightly", "semimonthly", "weekly", "daily", "hourly"] as const;
export type PayPeriod = typeof periods[number];
export type FinancialYear = "2025-26" | "2026-27";
export interface WorkPattern { hoursPerWeek: number; weeksPerYear: number; daysPerWeek: number }
export interface TaxInput extends WorkPattern {
  income: string;
  frequency: PayPeriod;
  financialYear: FinancialYear;
  employment: "employee";
  residency: "resident";
}
export interface TaxRules {
  financialYear: FinancialYear;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  verifiedAt: string;
  note: string;
  sources: readonly { title: string; url: string }[];
  brackets: readonly { lower: number; upper: number | null; basisPoints: number }[];
  medicare: { threshold: number; phaseInLimit: number; rate: number; phaseInRate: number };
  lito: { maximum: number; firstThreshold: number; secondThreshold: number; finalThreshold: number; secondMaximum: number; firstTaper: number; secondTaper: number };
}
export interface BracketResult { lowerCents: number; upperCents: number | null; rate: number; incomeCents: number; taxCents: number }
export interface TaxResult {
  input: TaxInput;
  annualGrossCents: number;
  taxBeforeOffsetCents: number;
  offsetCents: number;
  incomeTaxCents: number;
  medicareCents: number;
  deductionsCents: number;
  netCents: number;
  effectiveRate: number;
  marginalRate: number;
  keepRate: number;
  brackets: BracketResult[];
  rulesVersion: string;
  assumptions: readonly string[];
}
