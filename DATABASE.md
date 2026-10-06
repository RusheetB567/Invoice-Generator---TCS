# Database and migrations
Authoritative financial data lives in PostgreSQL-compatible storage, not Excel. Excel is an import/export format.

Versions: 1 accounts/workspaces and legacy vault scope; 2 server invoices/revisions/preferences/audit/object metadata/imports/privacy requests; 3 TOTP encrypted records, session assurance and replay digests. Migration SQL is in lib/server/account-migration.ts, backend-migration.ts and security-migration.ts.

Local PGlite persists in storage/tax-vault/postgres, unless INVOICEFLOW_DATA_DIR changes it. Never open one persisted PGlite directory from two running processes. Legacy unassigned documents are not exposed to new workspaces. The Prisma schema is a design artifact; it is not the active migration engine.

Production uses pg with verified TLS. Configure a migration-only connection privately; run `npm run db:migrate` for pending versions, then `npm run db:migrate -- --apply` after backup/review. Use separate migration and runtime roles. Runtime may perform required application DML but must not create schema objects or update/delete immutable invoice revisions or audit history. Session triggers need permission to insert audit records.

One account currently owns/belongs to one workspace. Supported roles: OWNER, ADMIN, MEMBER, VIEWER. No role-edit or invitation API exists. Queries explicitly scope by current workspace. PostgreSQL row-level security is not claimed; a future RLS layer needs integration tests before enablement.

The library currently returns the latest 1,000 active creator invoices; dashboard aggregates cover all active invoices. Workspace summaries include up to 500 recent audit events and do not constitute complete legal disclosure. Paging/full historical exports require further work.

