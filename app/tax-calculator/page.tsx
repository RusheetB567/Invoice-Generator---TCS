import type { Metadata } from "next";
import AppShell from "../components/app-shell";
import TaxWorkspace from "../components/tax-calculator/workspace";
export const metadata: Metadata = { title: "Tax Calculator | TCS InvoiceFlow", description: "Explore estimated Australian income tax, take-home pay and salary scenarios." };
export default function TaxCalculatorPage() {
  return <AppShell title="Tax calculator" subtitle="Your income, made clear."><TaxWorkspace /></AppShell>;
}
