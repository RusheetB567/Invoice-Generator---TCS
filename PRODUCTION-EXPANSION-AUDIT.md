# InvoiceFlow expansion audit

Reviewed 5 October 2026. Milestone 1: repository audit and architecture mapping.

This document records the current code and a proposed implementation sequence. It does not certify the platform as ready for public production. No application code, dependencies, database migrations, or Git history were changed for this milestone. The user's preference is to review changes and commit/sync personally.

## 1. Repository architecture

The working application is `C:\Users\RusheetBhatta\Desktop\invoiceflow`. It uses Next.js 16.3.8 App Router, React 19, strict TypeScript, CSS modules/Tailwind, and local Geist fonts. Private layouts obtain a server session and workspace before rendering. `AppShell` supplies navigation and shared interaction effects; `WorkspaceProvider` selects account/workspace-specific browser storage before mounting editors.

Better Auth and its Drizzle adapter provide local authentication. PGlite supplies persistent embedded PostgreSQL for accounts, memberships, contacts, enquiries, and document records. Document originals live on the local filesystem. ExcelJS exports workbooks; PDF parsing and Tesseract support document extraction. These services deliberately reject public production operation until managed infrastructure is configured.

The runtime uses SQL plus a Drizzle authentication mapping. `prisma/schema.prisma` describes a broader planned model and is not the applied runtime schema. This distinction must remain explicit.

## 2. Existing capabilities

- Public TCS landing page, real local signup/sign-in, business creation, onboarding, and protected dashboard.
- Account settings, password changes, logout, and session handling. Email verification remains deferred; recovery email, invitations, and MFA are not configured.
- Client/supplier directories with workspace ownership and archive/restore.
- Fresh narrative invoices, saved legacy table invoices, logo/accent branding, live preview, draft management, and browser printing.
- PDF/JPG/PNG upload, conservative extraction, source preview, editable review, explicit confirmation, and original retention.
- Confirmed-record income/expense, GST and financial-year views, reports, private enquiries, and Excel export.
- Responsive shared hover effects with reduced-motion/touch support. Reminder settings do not yet dispatch messages.

## 3. Invoice creator audit

`app/create/page.tsx` mixes form state, billing structure, calculations, preview, and saving in one component. Fresh invoices use narrative sections with headings, prose, amounts, and reordering. Existing table drafts are preserved for compatibility.

**Retain the user's explicit requirement: do not offer a table option for fresh invoices.** The attachment's optional custom-table direction is not authorization to reverse that choice. Future document schemas may preserve existing table templates without making them the fresh-invoice default.

`lib/domain/invoice-math.ts` already uses integer/BigInt arithmetic and explicit rounding. Reuse it. Drafts and their totals currently live in browser storage; there is no authoritative server invoice save/recalculation endpoint. Draft storage validates shape but cannot replace server validation. Sent/Paid labels are manual statuses, not evidence of email delivery or receipt of payment. Creator attachments currently retain names rather than durable original files.

PDF download currently opens the print dialog. It is not a deterministic server PDF artifact with a saved revision and reproducible layout.

## 4. Brand Studio audit

`app/settings/page.tsx` supports company details, logo, accent, business number and payment information. Logo checks and colour-contrast utilities already exist. Most theme settings are scoped browser data; the business profile also has a server-persisted record.

The document layout is still largely hard-coded JSX/CSS. Font, spacing, header/footer, density and template versioning need a separate theme contract. Business identity, document content and visual presentation should not overwrite one another.

## 5. Financial and tax audit

The existing tax-record module classifies uploaded records and allocates user-reviewed GST/business proportions using integer arithmetic. Reports aggregate confirmed AUD records by invoice date and Australian financial year. These are record summaries, not bank reconciliation, cash received, assessed income tax, or statutory profit calculations.

There is no personal income-tax calculator, versioned bracket engine, Medicare calculation, HELP calculation, salary/super package engine, or persisted tax scenario yet. Keep these separate from the existing invoice/GST ledger.

## 6. Database and tenancy audit

API access resolves workspace membership from the server session. Document reads, originals, deduplication and confirmation are workspace-scoped. Confirmation is transactional and rejects repeated confirmation. Old unowned records are preserved but not silently assigned to new users.

Current membership enforces one workspace per account. Roles exist, but invitations and role-management UI are future work. Browser draft keys separate account/workspace scopes, but browser storage is not shared, backed-up server persistence.

Local schema setup is additive SQL without a production migration ledger. Choose and reconcile one production persistence/migration approach before applying the planned Prisma schema. Moving originals to private object storage also requires authorization, retention, backup and restore verification.

## 7. Ranked risks

| Priority | Finding | Required treatment |
| --- | --- | --- |
| Deployment gate | Local auth/database/file services reject public production | Configure managed database, private files, secrets and migration process; verify deployed tenant isolation |
| High | Invoice totals and drafts are browser-owned | Server validation, recomputation, durable workspace-owned invoices and revisions |
| High | Print output is not a reproducible PDF artifact | Shared renderer contract, saved revision snapshots and verified PDF generation |
| High | Planned Prisma and live SQL schemas differ | Reconcile schema ownership and versioned migrations without losing existing records |
| High | Personal tax rules/engine do not exist | Verify complete official rules for each supported year and explicit scenario scope |
| Medium | Creator combines data, theme and layout | Extract typed contracts and small section components incrementally |
| Medium | Manual statuses, numbering and payment history | Transactional numbering and a payment ledger before automated balance claims |
| Medium | Extraction is bounded local processing | Add production jobs, retry handling and extraction provenance when moving to hosted ingestion |
| Medium | Browser themes/drafts and local files lack managed backup | Explicit migration/import, retention and restore plan |

## 8. Adaptive invoice architecture

Separate three versioned contracts:

- `DocumentData`: seller/customer snapshots, dates, currency, ordered narrative blocks, adjustments, payment terms and calculated totals.
- `DocumentTemplate`: supported block types, layout rules, required fields and renderer version.
- `BrandTheme`: logo reference, accessible colours, typography, spacing and header/footer presentation.

Use a typed block registry for narrative service sections, milestones, descriptions, notes, payment instructions and custom fields. Preserve legacy tables with an explicit adapter. Start with the existing narrative model; do not create a new page or rewrite the whole editor.

Validate input at the boundary, recompute all amounts on the server, and save immutable issued-document snapshots. Client preview can use the same pure calculation engine, but client totals are never authoritative. Keep preview and PDF rendering tied to the same normalized document contract.

## 9. Tax calculator architecture

Build a dependency-free pure domain engine first, with typed inputs, period conversion, currency-safe rounding and versioned Australian rule bundles. Each rule bundle needs financial year, effective dates, rule version, official sources, verification date, supported assumptions and explicit exclusions.

Begin with one verified scenario, such as full-year Australian resident individual salary income. Add Medicare, offsets, HELP and super-package handling only when their complete rules are verified and tested. Employee income, contractor revenue, and company profit are different inputs; do not silently apply salary rules to all three.

Use one shared engine for immediate browser results and authenticated server recalculation through a bounded, validated `/api/tax/calculate` endpoint. Slider movement should not generate a network request for every pixel. Saved scenarios are optional and must not write calculated estimates into the invoice ledger.

Native SVG/CSS can provide bracket contributions and distribution visuals without a chart dependency. Clearly distinguish annual income-tax estimates, period allocations, and PAYG withholding.

## 10. Official rule verification

The [Income Tax Rates Act 1986, compilation effective 1 July 2026](https://www.legislation.gov.au/C2004A03348/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html) confirms that rates differ between financial years. A single unversioned rate array would be incorrect.

The [ATO software developer PAYG guidance](https://softwaredevelopers.ato.gov.au/2025-pay-you-go-payg-withholding-tax-tables) also distinguishes withholding schedules and effective-date changes. An annual assessment estimate must not be presented as an exact payslip withholding calculation.

Complete verification is still required for the selected year's resident thresholds, tax-free threshold eligibility, Medicare reduction/exemption and family thresholds, offsets, HELP repayment rules, super guarantee, rounding, and special residency/employment cases. Canonical ATO resident-rate, Medicare-reduction and study-loan pages were inaccessible to the browsing tool during this audit; those rules are **not marked fully verified**. No tax rates were added to the application.

## 11. File impact map

| Existing area | Incremental change |
| --- | --- |
| `app/create/page.tsx`, `creator.module.css` | Extract narrative inputs/preview; preserve appearance and existing drafts |
| `lib/local-data.ts` | Versioned legacy adapter and explicit local-to-server import |
| `lib/domain/invoice-math.ts` | Reuse money arithmetic; add contract-level calculation tests |
| `app/settings/page.tsx`, business settings | Separate business identity from versioned visual theme |
| `lib/server/workspaces.ts`, private layouts | Reuse authorization; do not accept client-selected tenant ownership |
| Runtime schema/migrations | Durable invoice/revision/theme/template records, then optional tax scenarios |
| `app/components/app-shell.tsx` | Add tax-calculator navigation when its route is functional |
| Existing reports/vault modules | Preserve confirmed-record calculations; keep personal tax scenarios separate |

Proposed new modules: `lib/domain/invoice-document.ts`, server invoice repository/service and `/api/invoices`; `lib/tax/core/*`, `lib/tax/australia/rules/*`, `/api/tax/calculate`, and `app/tax/calculator/*`. Names are proposals, not files claimed to exist.

## 12. Proposed schema changes

Add workspace-owned invoice documents with draft/issued lifecycle, currency, validated data, recomputed totals and revision number. Add immutable revision snapshots carrying template/theme/renderer versions. Store template and theme versions separately; snapshot seller/customer information so later profile edits do not alter issued invoices.

Add optional workspace-owned tax scenarios carrying validated inputs, outputs, assumptions, financial year and rules version. Require workspace ownership for every read/write and test cross-workspace access. Do not persist sensitive scenario inputs by default. No schema migration is part of this audit.

## 13. Text wireframes

```text
CREATE INVOICE
Title + draft state                         Save / Preview / Download
Details and narrative sections              Live document preview
  Company / customer                        Zoom / page controls
  Dates / currency                          Accurate totals
  Service heading + description + amount
  Add section / reorder
  Advanced fields (collapsed)
  Branding / payment terms (collapsed)

TAX CALCULATOR
Financial year + supported scenario
Gross income / pay period                    Estimated take-home
Optional details (collapsed)                 Tax / Medicare / effective rate
Assumptions + unsupported cases              Bracket contribution visual
                                             Annual / monthly / weekly views
Compare an adjusted income                   Scenario difference
Rules version / sources / estimate explanation
```

Use generous spacing, progressive disclosure, keyboard-accessible controls and restrained shared hover effects. Mobile stacks inputs above results; respect reduced motion.

## 14. Milestone sequence

1. **Completed here:** audit and architecture map.
2. Typed document contract, legacy adapter, server validation/calculation and durable invoice foundation.
3. Quick creator improvements, section framework and custom fields; then live preview and deterministic PDF rendering.
4. Versioned Brand Studio and presets, preserving narrative-first fresh invoices.
5. Tax route/navigation, complete official rule verification and pure calculation engine with boundary tests.
6. Calculator inputs/results, lightweight visuals, period/hourly views and scenario comparison.
7. Mobile/accessibility, tenant security, integration tests, performance and documentation.
8. Managed infrastructure, production build/deployed verification and honest readiness review.

This groups the brief's 28 milestones into reviewable deliveries; it does not mark future milestones complete.

## 15. Immediate next implementation

Start with the invoice document contract and server-authoritative calculation boundary. This fixes the most important creator weakness and gives both preview and future PDF generation a stable foundation. Keep the current UI and dependencies while doing it. Implement tax rules as a separate verified domain module rather than embedding legislation into page components.

## Verification baseline

The preceding implementation delivery passed 20 tests, lint and the production build. Those checks were not rerun for this documentation-only milestone. Existing tests cover local accounts, tenant isolation, file access, record confirmation/deduplication, browser storage scopes, invoice arithmetic, and Excel output. They do not establish hosted production readiness or a functioning personal tax calculator.

Repository HEAD remained `0f6050e` during the audit. Existing uncommitted work was preserved. No commit, push, sync or staging operation was performed.
