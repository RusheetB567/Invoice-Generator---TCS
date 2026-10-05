import test from "node:test";
import assert from "node:assert/strict";
import { calculateTax, calculateMedicare, calculateOffset, compareTax, ruleSets } from "../lib/tax/calculate.ts";
import { annualise, forPeriod, periodBreakdown } from "../lib/tax/periods.ts";
import { taxInputSchema } from "../lib/tax/schemas.ts";
const input = { income: "80000", frequency: "annual", financialYear: "2026-27", employment: "employee", residency: "resident", hoursPerWeek: 38, weeksPerYear: 52, daysPerWeek: 5 };
const at = (income, financialYear = "2026-27") => calculateTax({ ...input, income: String(income), financialYear });
test("verified year-specific resident brackets and worked examples", () => {
  assert.equal(at(80000).incomeTaxCents, 1452000);
  assert.equal(at(80000).medicareCents, 160000);
  assert.equal(at(80000).netCents, 6388000);
  assert.equal(at(80000, "2025-26").netCents, 6361200);
  assert.equal(at(50000, "2025-26").taxBeforeOffsetCents, 578800);
  assert.equal(at(50000, "2025-26").offsetCents, 25000);
  assert.equal(at(50000, "2025-26").netCents, 4346200);
  assert.equal(at(45000).taxBeforeOffsetCents, 402000);
  assert.equal(at(135000).taxBeforeOffsetCents, 3102000);
  assert.equal(at(190000).taxBeforeOffsetCents, 5137000);
  assert.equal(at(200000).taxBeforeOffsetCents, 5587000);
});
test("bracket boundaries, no flat-rate taxation and decomposition", () => {
  for (const boundary of [0, 18200, 45000, 135000, 190000]) {
    for (const change of [0, 0.01, 1]) {
      const result = at((boundary + change).toFixed(2));
      assert.equal(result.brackets.reduce((sum, row) => sum + row.incomeCents, 0), result.annualGrossCents);
      assert.equal(result.brackets.reduce((sum, row) => sum + row.taxCents, 0), result.taxBeforeOffsetCents);
      assert.equal(result.netCents + result.deductionsCents, result.annualGrossCents);
      assert.ok(result.netCents >= 0);
    }
  }
  assert.equal(at(45000).marginalRate, 15);
  assert.equal(at("45000.01").marginalRate, 30);
  assert.equal(at(0).effectiveRate, 0);
});
test("low income offset tapers and cannot refund tax or reduce Medicare", () => {
  const rule = ruleSets["2026-27"].lito;
  assert.equal(calculateOffset(3750000, rule), 70000);
  assert.equal(calculateOffset(4000000, rule), 57500);
  assert.equal(calculateOffset(4500000, rule), 32500);
  assert.equal(calculateOffset(6000000, rule), 10000);
  assert.equal(calculateOffset(6666700, rule), 0);
  assert.equal(calculateOffset(6666800, rule), 0);
  assert.equal(at(20000).incomeTaxCents, 0);
  assert.equal(at(30000).medicareCents, 19890);
  assert.equal(at(30000).incomeTaxCents, 107000);
});
test("Medicare single threshold, phase-in cap and full levy use amended law", () => {
  const rule = ruleSets["2025-26"].medicare;
  assert.equal(calculateMedicare(2801100, rule), 0);
  assert.equal(calculateMedicare(2801200, rule), 10);
  assert.equal(calculateMedicare(3000000, rule), 19890);
  assert.equal(calculateMedicare(3501300, rule), 70020);
  assert.equal(calculateMedicare(3501400, rule), 70028);
  assert.equal(calculateMedicare(5000000, rule), 100000);
});
test("all frequencies, fractional working hours and cent reconciliation", () => {
  assert.equal(annualise(4500, "hourly", { ...input, weeksPerYear: 48 }), 8208000);
  assert.equal(annualise(10000, "daily", { ...input, weeksPerYear: 48 }), 2400000);
  assert.equal(annualise(100, "hourly", { ...input, hoursPerWeek: 37.5 }), 195000);
  for (const [period, units] of [["annual", 1], ["monthly", 12], ["fortnightly", 26], ["semimonthly", 24], ["weekly", 52], ["daily", 260], ["hourly", 1976]]) {
    assert.equal(annualise(100, period, input), units * 100);
    assert.equal(forPeriod(units * 100, period, input), 100);
    const values = periodBreakdown(at("80000.01"), period, input);
    assert.equal(values.net + values.tax + values.medicare, values.gross);
  }
  assert.throws(() => annualise(100, "daily", { ...input, weeksPerYear: 0 }));
});
test("comparisons remain consistent for raises, reductions and the same income", () => {
  assert.deepEqual(compareTax(at(80000), at(80000)), { gross: 0, deductions: 0, net: 0, rate: 0 });
  const delta = compareTax(at(80000), at(90000));
  assert.equal(delta.gross, 1000000);
  assert.equal(delta.net, 680000);
  assert.equal(delta.net + delta.deductions, delta.gross);
  assert.equal(compareTax(at(90000), at(80000)).net, -680000);
  assert.throws(() => compareTax(at(80000), at(80000, "2025-26")));
});
test("invalid money, unsupported modes, years and annualisation overflow reject", () => {
  for (const income of ["", "-1", "1e6", "NaN", "Infinity", "1,000", "1.001", "10000000.01"]) assert.equal(taxInputSchema.safeParse({ ...input, income }).success, false);
  for (const patch of [{ employment: "contractor" }, { residency: "foreign" }, { financialYear: "2027-28" }, { frequency: "day" }, { hoursPerWeek: 0 }, { hoursPerWeek: 38.3 }, { weeksPerYear: 53 }, { total: 1 }]) assert.throws(() => calculateTax({ ...input, ...patch }));
  assert.throws(() => calculateTax({ ...input, frequency: "hourly", income: "10000000" }));
  assert.equal(at(10000000).annualGrossCents, 1000000000);
});
