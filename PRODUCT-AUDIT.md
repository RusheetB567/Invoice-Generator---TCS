# InvoiceFlow product audit and next milestones

## Baseline reviewed

Existing Next.js 16 / React 19 / TypeScript project with TCS landing/workspace styles, local Geist typography, pointer/reveal effects and reduced-motion support. The fresh creator supports narrative billing sections, exact integer calculations, branding and browser print output. Original TCS table samples remain optional. Browser drafts have editable status labels. The document inbox reads PDF text and local OCR, preserves original files, requires human confirmation and exports confirmed Australian records to Excel. PostgreSQL persistence was previously an unassigned localhost vault. The wider Prisma schema was a design rather than an applied database.

## Highest priority gap addressed

The old interface had no user identity or private business ownership. Adding more financial features before resolving ownership would expose shared records when hosted. This milestone implements account/session handling, workspace creation, organisation onboarding, protected pages and workspace-scoped server operations. The supplied navigation now groups Invoices, Tax and Settings, with working income/report/document views and persisted client/supplier directories. See ACCOUNTS-WORKSPACES.md for the exact implemented boundaries.

## Preserve

Keep TCS platform identity separate from customer invoice branding; use the user's company defaults in their documents. Preserve the fresh narrative invoice workflow, the optional historical sample, exact money calculations, source evidence, review-before-confirmation, Excel field types, readable typography, whitespace and accessible/reduced-motion interactions. Never hide information to fit decorative layouts.

## Remaining gaps and delivery order

1. **Production data layer:** reconcile the live SQL/Drizzle mappings with the wider domain design; select a single ORM; add reviewed production migrations, managed PostgreSQL, private object storage, backups and recovery tests. Add email verification/reset delivery and membership invitations. Local credentials and files must never enter Git.
2. **Server invoice lifecycle:** migrate local drafts only by explicit user choice; save business-scoped invoices and party/brand snapshots; recompute totals; revisions, atomic numbering, issue/void transitions and actual payment records. A Paid label is not payment evidence. Browser drafts currently do not sync between devices.
3. **Document rendering:** introduce separate invoice data, schema-driven template structure, brand theme, layout and renderer modules; add direct multi-page PDF generation, overflow rules and visual regression fixtures. Print-to-PDF is the current renderer. Fresh invoices continue to omit a table option unless the user explicitly changes that requirement.
4. **Extraction robustness:** queues, retry/idempotency, confidence/provenance, broader supplier/date/ABN/line-item formats, multilingual OCR and safe processing limits. Extraction suggestions are not financial truth.
5. **Accounting depth:** payments/cash-vs-accrual reporting, income/expense mappings, fiscal/tax configuration per jurisdiction, review history and accountant handoff. Current reports use confirmed uploaded invoice dates in AUD, not a tax return, BAS or recognised revenue ledger.
6. **Advanced SaaS:** reusable invoice packs/custom fields, versioned template library, recurring automation, verified reminders, subscriptions, entitlement checks, integrations and carefully controlled AI assistance. No fake OCR confidence, charts, email delivery or subscription claims.

## Technical debt and release criteria

The local singleton database and in-memory auth rate limiter cannot be scaled across deployment instances. Runtime auth schema and the future Prisma design must not drift into two competing migrations. Local browser branding is separate from the server business profile; user edits should eventually move into versioned server themes. Monetary integers and currency boundaries must remain exact. Complete account isolation, recovery, file retention, production cookies/headers, audit logs, monitoring and full browser/API/database checks before hosting real financial records publicly.

The master brief describes the full product direction. This delivery completes the requested local account-to-private-workspace slice; it does not claim all future product phases are complete. Git publication is controlled by the user.
