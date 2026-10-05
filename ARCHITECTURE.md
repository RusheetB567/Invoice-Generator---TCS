# InvoiceFlow by The Code Squad

## Current milestone

The TCS interface and local invoice editor work. Creator drafts, branding and reminder preferences use browser storage. The document inbox now supports local extraction/OCR, review, embedded PostgreSQL persistence and Excel export; see RECORDS-VAULT.md. Local Better Auth sessions, business onboarding, membership checks, contact directories and workspace-scoped records are implemented; see ACCOUNTS-WORKSPACES.md. There is no cloud persistence, email delivery or direct invoice PDF renderer yet. The Prisma multi-tenant schema remains a validated design, separate from the local vault adapter.

## Architecture

Keep the existing Next.js App Router / TypeScript application as a modular monolith. Use PostgreSQL with Prisma for business records; private object storage for documents; shared domain functions for calculations; server services for authenticated operations. Keep TCS purple, dark workspace surfaces, Geist typography, generous spacing, restrained hover effects and reduced-motion support throughout.

The public landing page leads to two workflows: create an invoice, or upload and review a received invoice. Workspace navigation will group invoices, contacts, documents, reports and settings. Show only working features as active actions.

```text
app/                 Pages, layouts and thin route handlers
lib/domain/          Pure calculations and financial record rules
lib/server/          Future authenticated application services and repositories
lib/local-data.ts    Current local demo storage; replace explicitly, not silently
prisma/              Business schema and reviewed migrations
tests/               Calculation tests now; access-control/integration tests next
```

## Decisions

- A user belongs to a business through a membership. Every business resource is scoped to that business. Composite foreign keys prevent attaching another business's contact, invoice block, payment or document.
- Contacts have client and supplier roles rather than separate duplicate identities.
- New invoices contain ordered narrative billing blocks with headings, optional prose and explicit amounts. Do not expose a table switch in the fresh invoice workflow. The original TCS table remains an explicitly selected legacy sample.
- Store monetary values in integer minor units, quantities in hundredths and percentages in basis points. Currency support currently assumes two decimal places. Share `lib/domain/invoice-math.ts` between preview and future server services. The server must recompute totals from validated inputs rather than trust submitted totals.
- Freeze issuer, recipient and branding snapshots on an invoice. Editing a business or contact must not rewrite historical invoice contents. Use revisions to reject conflicting edits.
- Use internal IDs independently of invoice numbers. Reserve generated numbers atomically within a business. A database migration must enforce unique issued numbers per business; received numbers can repeat between suppliers.
- Derive overdue from due date, remaining balance and cancellation state. Payments are separate records. Lock the invoice when adding a payment to prevent concurrent overpayment.
- Better Auth with the official Drizzle adapter now manages local database sessions and password hashing. Email verification/reset delivery remains deferred. The wider Prisma design is not applied; reconcile it with the live mappings before choosing one production ORM.
- Use private local storage during development and an S3-compatible adapter in production. PostgreSQL stores keys, hashes and metadata, not uploaded binary files.

## Document pipeline

Validate extension, MIME signature, size and ownership → save private document → extract selectable PDF text → OCR only if needed → validate candidate JSON → preserve raw data and confidence → side-by-side human review → confirmation transaction → official invoice record.

Each stage has a service boundary. Failures retain the uploaded document and a safe error code; retrying must be idempotent. A queued worker can replace synchronous processing later. No invoice candidate enters reports before confirmation.

## Delivery order

The document inbox, local OCR/review, embedded database and Excel export have now been implemented as a development-only milestone at the user's request. Their shared/cloud versions still require the authentication and ownership work below.

1. **Complete:** interface refinements, flexible editor, local draft compatibility, shared maths and tests, initial schema.
2. **Complete locally:** embedded PostgreSQL/Drizzle auth mapping, sessions, memberships, business profile and access-isolation tests. **Next:** production PostgreSQL/object storage and reconciled migrations before cloud writes.
3. Contacts and persisted invoice CRUD, server validation, numbering and payment records.
4. Direct PDF rendering, generation/version storage and download.
5. Private uploads, PDF text extraction, OCR adapter and human review.
6. XLSX/CSV export, real dashboard/report data and Australian financial year filters.
7. Production security checks, backups, email delivery, monitoring and deployment.

Keep each milestone runnable. Do not describe planned services as working features.

## Reference decisions

Prisma's supported integration guide: https://www.prisma.io/docs/guides/authentication/better-auth/nextjs

Better Auth Next.js integration: https://better-auth.com/docs/integrations/next

