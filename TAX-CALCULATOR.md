# Australian tax calculator

Dedicated private route: `/tax-calculator`. The primary sidebar has a direct entry and active state. This is a separate analysis workspace; calculations do not change uploaded GST records or invoice totals.

## Implemented

The first view contains gross income, income frequency, one Calculate action and a live take-home result. Financial year and work pattern sit inside closed Calculation settings. The employee/full-year-resident scope remains explicit. Seven input/display periods and two financial years are supported.

The illustrated income mountain places annual gross income above the ground line and annual income tax plus Medicare below it. The labels update immediately and the geometry transitions when income changes. Height/depth are illustrative, non-linear geometry, not a quantitative chart. Zero income has zero height/depth. The primary take-home and its tax/Medicare breakdown follow the selected display period; landscape labels stay explicitly annual. An accessible text alternative includes every annual amount.

More analysis starts closed. A single tool selector exposes the income breakdown, brackets, income explorer, pay-rise simulator, salary comparison or hourly/salary converter, one at a time. Requested scenario/rate components load on demand. Previously opened tools retain their edits when switching or closing the section. Briefly invalid main input hides analysis without discarding tool state. Assumptions and rule sources have their own closed disclosure.

Desktop places the simple inputs beside the mountain. Mobile stacks them and keeps controls within the viewport. Shared TCS hover surfaces, visible focus and reduced-motion support apply. The landscape uses SVG and CSS, with no animation or chart dependency. Reduced-motion preferences disable movement; touch users can access the same native controls without hover.

## Quiet suggestions

Suggestions are hidden until three valid, completed income edits. Completion means leaving the edited income field, submitting Calculate, or completing an income-slider interaction. The prefilled example, individual keystrokes, invalid amounts and consecutive identical annual amounts do not count; blur followed by Calculate counts once. After eligibility, one contextual suggestion appears. Further entries update that suggestion's figures without cycling it. A subsequent calculator visit/reload advances to the next of five insights, wrapping after the fifth.

Only a usage count and rotation cursor are persisted in optional local browser storage, scoped by account and business workspace. No salary, income history, result or identity fields are saved in that metadata. Corrupt metadata resets to a quiet first view. Strict Mode setup does not advance the cursor twice. If browser storage is unavailable, suggestions work within the current visit without persisting eligibility between visits.

## State and calculation

Validated input → annualised integer cents → bracket contributions → non-refundable low income tax offset → single Medicare levy → annual result → display-period allocation. All visualisations and scenarios consume this shared engine. Slider movement performs no API requests. Calculate calls `/api/tax/calculate` with bounded JSON; the server authenticates membership, validates input and recomputes rather than trusting submitted totals. Responses are not cached. No scenario or income data is saved.

Amounts use BigInt intermediates and round half up to cents. Individual bracket contributions sum to income tax before the offset. Applied offset is capped at that tax. Period net is derived from rounded displayed components to preserve cent reconciliation. This is a planning estimate, not a reproduction of assessment or PAYG rounding. Annual averages use 12 months, 26 fortnights, 24 half-months and 52 weeks; daily/hourly use entered workdays/hours and working weeks. Gross input and annualised gross are capped at $10,000,000.

## Rule provenance and scope

Verified 5 October 2026. Every rule set carries a financial year, effective dates, version, verification date, source links and explanatory note. Rules remain outside React components.

- Resident bracket values and the full-year tax-free threshold: [Income Tax Rates Act 1986, July 2026 compilation](https://www.legislation.gov.au/C2004A03348/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html), definition of tax-free threshold and Schedule 7. 2025–26 uses the 16% first taxable bracket; 2026–27 uses 15%.
- Single Medicare levy/reduction: [Medicare Levy Act 1986](https://www.legislation.gov.au/C2004A03351/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html), sections 3, 6 and 7. Uses the enacted $28,011 lower threshold, $35,013 phase-in limit, 10% phase-in cap and 2% standard rate.
- Medicare application year: [2026 amending Act, Schedule 5, item 14](https://www.legislation.gov.au/C2026A00058/asmade/2026-06-30/text/original/pdf). These amendments apply to 2025–26 assessments and later years. The 2026–27 result is labelled current-law; further threshold amendments before year-end may change it.
- Low income tax offset: [Income Tax Assessment Act 1997, August 2026 compilation](https://www.legislation.gov.au/C2004A05138/2026-08-27/2026-08-27/text/original/epub/OEBPS/document_2/document_2.html), sections 61-110 and 61-115. The current official HTML was retrieved directly after the browser reader timed out. Offset is non-refundable and does not reduce the levy.

The calculator assumes a single adult, full-year Australian resident employee with gross salary equal to taxable income. No HELP/student loan repayment, Medicare surcharge, family reduction, pensioner concession, levy exemption, salary sacrifice, super, other income or other offset is included. No work-expense or standard deduction is automatically claimed. Contractor, sole trader, foreign resident and working holiday maker modes are unavailable. These assumptions appear beside inputs and in the source disclosure; the reference website's numeric results and employer-tax illustration were not used as tax rules.

## Files

- `app/tax-calculator/{page,layout}.tsx`: route and existing private-workspace guard.
- `app/components/app-shell.tsx`: direct navigation.
- `app/components/tax-calculator/{workspace,input-panel,mountain,analysis,insight,income-overview,brackets,scenarios}.tsx`, `use-engagement.ts`, `presentation.ts`, `tax.module.css`: progressively disclosed responsive interface.
- `lib/tax/engagement.ts`: account/workspace metadata keys, eligibility and reload rotation.
- `lib/tax/{types,schemas,periods,calculate}.ts`, `australia/rules/{shared,2025-26,2026-27}.ts`: validated domain and versioned rules.
- `app/api/tax/calculate/route.ts`: stateless authenticated recalculation.
- `tests/tax-calculator.test.mjs`, `tests/tax-engagement.test.mjs`, `tests/tax-render.test.mjs`, tax API assertions in `tests/accounts.test.mjs`: financial boundaries, conversion, scenarios, invalid input, quiet-first-view rendering, eligibility/rotation/isolation, landscape figures/geometry and authenticated requests.

No schema, dependency or invoice storage migration is required. Existing local auth/hosting limitations still apply; this does not configure public SaaS hosting. Saving/sharing/exporting tax scenarios is not implemented. Git commits and syncing remain with the user.

## Standard edition cleanup

Clients, Suppliers and Enquiries are removed from navigation. Their old routes redirect to the dashboard or tax records. The saved-client picker is removed from fresh invoice creation; bill-to details remain editable. Contact storage/services and reusable components remain intact for future enhanced-edition work, with the enquiry component retained under `app/components/enhanced`. This preserves records without claiming subscription entitlements are already implemented. Repeated navigation arrows, the sidebar promotion and the heading ornament are removed to simplify the panel.

## Delivery verification — 5 October 2026

- Main project after simplification: 38 tests passed; full ESLint check passed; webpack production build passed, including TypeScript and route generation.
- Disposable local HTTP review: signup/onboarding, private route, authenticated tax calculation, unsupported-year rejection and logout passed. No user account or invoice record was used for the review.
- Main localhost server: unauthenticated `/tax-calculator` redirected to `/sign-in`; unauthenticated calculation API returned 401.
- Browser automation rejected the preview request under its security policy. Interactive browser and visual layout verification remains outstanding; semantic server rendering is not a substitute for it.
- No dependency was added; no Git staging, commit, push or sync was performed. Existing source files were backed up before applying the change.
