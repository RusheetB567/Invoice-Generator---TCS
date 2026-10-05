import type { PayPeriod, WorkPattern } from "./types";
/** Period allocations are planning averages, not PAYG withholding or a pay-calendar forecast. */
export function periodUnits(period: PayPeriod, pattern: WorkPattern): number {
  if (!Number.isFinite(pattern.hoursPerWeek) || pattern.hoursPerWeek < 1 || pattern.hoursPerWeek > 100 || !Number.isInteger(pattern.weeksPerYear) || pattern.weeksPerYear < 1 || pattern.weeksPerYear > 52 || !Number.isInteger(pattern.daysPerWeek) || pattern.daysPerWeek < 1 || pattern.daysPerWeek > 7 || pattern.hoursPerWeek * 2 % 1 !== 0) throw new RangeError("Enter a valid work pattern.");
  switch (period) {
    case "annual": return 1;
    case "monthly": return 12;
    case "fortnightly": return 26;
    case "semimonthly": return 24;
    case "weekly": return 52;
    case "daily": return pattern.daysPerWeek * pattern.weeksPerYear;
    case "hourly": return pattern.hoursPerWeek * pattern.weeksPerYear;
    default: throw new RangeError("Unsupported pay period.");
  }
}
export function roundRatio(value: bigint, numerator: bigint, denominator: bigint): number {
  if (value < BigInt(0) || numerator < BigInt(0) || denominator <= BigInt(0)) throw new RangeError("Invalid amount conversion.");
  const result = (value * numerator + denominator / BigInt(2)) / denominator;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Amount is too large.");
  return Number(result);
}
export function annualise(cents: number, period: PayPeriod, pattern: WorkPattern): number {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("Invalid income.");
  return roundRatio(BigInt(cents), BigInt(Math.round(periodUnits(period, pattern) * 2)), BigInt(2));
}
export function forPeriod(cents: number, period: PayPeriod, pattern: WorkPattern): number {
  if (!Number.isSafeInteger(cents)) throw new RangeError("Invalid amount.");
  const sign = cents < 0 ? -1 : 1;
  return sign * roundRatio(BigInt(Math.abs(cents)), BigInt(2), BigInt(Math.round(periodUnits(period, pattern) * 2)));
}
export function periodBreakdown(result: { annualGrossCents: number; incomeTaxCents: number; medicareCents: number }, period: PayPeriod, pattern: WorkPattern) {
  const gross = forPeriod(result.annualGrossCents, period, pattern), tax = forPeriod(result.incomeTaxCents, period, pattern), medicare = forPeriod(result.medicareCents, period, pattern);
  // Derive net from displayed components so rounded figures reconcile to the cent.
  return { gross, tax, medicare, total: tax + medicare, net: gross - tax - medicare };
}
