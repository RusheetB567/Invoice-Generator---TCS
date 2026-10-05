import { periods, type PayPeriod } from "../../../lib/tax/types";
export const labels: Record<PayPeriod, string> = { annual: "Annual", monthly: "Monthly", fortnightly: "Fortnightly", semimonthly: "Semimonthly", weekly: "Weekly", daily: "Daily", hourly: "Hourly" };
export const suffixes: Record<PayPeriod, string> = { annual: "year", monthly: "month", fortnightly: "fortnight", semimonthly: "half-month", weekly: "week", daily: "working day", hourly: "working hour" };
const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2, minimumFractionDigits: 2 });
export function money(cents: number) { return currency.format(cents / 100); }
export function shortMoney(cents: number) { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(cents / 100); }
export function signedMoney(cents: number) { return `${cents > 0 ? "+" : ""}${money(cents)}`; }
export function percentage(value: number) { return `${value.toFixed(1)}%`; }
export { periods };
