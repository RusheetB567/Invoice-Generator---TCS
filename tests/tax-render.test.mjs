import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Node-only semantic rendering test. CSS layout still needs browser visual review.
const cssHook = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, {get: (_, key) => String(key)});" };
  return nextLoad(url, context);
} });
const { default: TaxWorkspace } = await import("../app/components/tax-calculator/workspace.tsx");
const { default: IncomeMountain } = await import("../app/components/tax-calculator/mountain.tsx");
const { default: AdvancedAnalysis } = await import("../app/components/tax-calculator/analysis.tsx");
const { default: IncomeInsight } = await import("../app/components/tax-calculator/insight.tsx");
const { default: AppShell } = await import("../app/components/app-shell.tsx");
cssHook.deregister();
const { calculateTax } = await import("../lib/tax/calculate.ts");
const input = { income: "80000", frequency: "annual", financialYear: "2026-27", employment: "employee", residency: "resident", hoursPerWeek: 38, weeksPerYear: 52, daysPerWeek: 5 };
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
test("calculator first view keeps expert controls and suggestions out of the foreground", () => {
  const html = renderToStaticMarkup(createElement(TaxWorkspace));
  for (const phrase of ["Gross income", "Income frequency", "Calculation settings", "Calculate tax", "$63,880.00", "More analysis", "Assumptions &amp; sources", "Total annual income", "Annual tax + Medicare"]) assert.ok(html.includes(phrase), phrase);
  assert.equal((html.match(/<button\b/g) ?? []).length, 1, "one primary action before expanding tools");
  assert.equal((html.match(/<details\b/g) ?? []).length, 3);
  assert.equal(/<details\b[^>]*\bopen(?:=|\s|>)/.test(html), false, "all disclosures initially closed");
  for (const phrase of ["One income insight", 'type="range"', "Choose a tool", "Your income, on your terms", "What if you earned more?", "Compare two incomes", "Annual bracket contributions", "For every $100 you earn"]) assert.equal(html.includes(phrase), false, phrase);
  assert.ok(html.includes('aria-label="Income overview"'));
  assert.ok(html.includes("AU-resident-single-2026-27.current-law.v1"));
});
test("mountain numbers and geometry update with income, including zero and period changes", () => {
  const at = income => calculateTax({ ...input, income });
  const mountain = (income, period = "annual") => render(IncomeMountain, { result: at(income), period, onPeriod() {} });
  const base = mountain("80000"), raised = mountain("120000"), zero = mountain("0");
  for (const [income, html] of [["80000", base], ["120000", raised], ["0", zero]]) {
    const result = at(income);
    const dollars = cents => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
    for (const cents of [result.annualGrossCents, result.deductionsCents, result.netCents, result.incomeTaxCents, result.medicareCents]) assert.ok(html.includes(dollars(cents)));
    assert.ok(html.includes('role="img"'));
  }
  const heights = html => [...html.matchAll(/style="height:([\d.]+)px"/g)].map(match => Number(match[1]));
  const [incomeHeight, taxDepth] = heights(base), [raisedHeight, raisedDepth] = heights(raised);
  assert.ok(raisedHeight > incomeHeight && raisedDepth > taxDepth);
  assert.deepEqual(heights(zero), [0, 0]);
  const monthly = mountain("80000", "monthly");
  assert.ok(monthly.includes("$5,323.34"));
  assert.ok(monthly.includes("$80,000.00"), "landscape stays explicitly annual");
  assert.ok(monthly.includes("per month"));
});
test("multiple landscapes use distinct SVG paint identifiers", () => {
  const props = { result: calculateTax(input), period: "annual", onPeriod() {} };
  const html = renderToStaticMarkup(createElement("div", {}, createElement(IncomeMountain, props), createElement(IncomeMountain, props)));
  const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  for (const id of ids) assert.ok(html.includes(`url(#${id})`));
});
test("expanded analysis renders only the selected tool", () => {
  const props = { result: calculateTax(input), period: "annual", open: true, tool: "explore", onPeriod() {}, onOpen() {}, onTool() {}, onIncome() {}, onCommit() {} };
  const explorer = render(AdvancedAnalysis, props);
  assert.ok(explorer.includes('type="range"'));
  assert.ok(explorer.includes('aria-valuetext="$80,000 annual gross income"'));
  assert.equal(explorer.includes("Where your income goes"), false);
  const breakdown = render(AdvancedAnalysis, { ...props, tool: "breakdown" });
  assert.ok(breakdown.includes("Where your income goes"));
  assert.ok(breakdown.includes('aria-pressed="true"'));
  assert.equal(breakdown.includes('type="range"'), false);
});
test("each suggestion is one contextual insight with one action", () => {
  for (const income of ["0", "80000", "10000000"]) {
    for (let index = 0; index < 5; index++) {
      const html = render(IncomeInsight, { result: calculateTax({ ...input, income }), index, onExplore() {} });
      assert.equal((html.match(/<aside\b/g) ?? []).length, 1);
      assert.equal((html.match(/<h2\b/g) ?? []).length, 1);
      assert.equal((html.match(/<button\b/g) ?? []).length, 1);
      assert.equal(/NaN|Infinity|undefined/.test(html), false);
    }
  }
});
test("standard sidebar includes the calculator and omits enhanced areas", () => {
  const html = renderToStaticMarkup(createElement(AppShell, { title: "Tax calculator" }));
  assert.ok(html.includes('href="/tax-calculator"'));
  for (const route of ["/clients", "/suppliers", "/tax/enquiries"]) assert.equal(html.includes(`href="${route}"`), false);
  assert.equal(html.includes("YOUR BRAND. YOUR RULES."), false);
});
