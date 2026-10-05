# Database foundation

`prisma/schema.prisma` is the initial PostgreSQL design, validated with Prisma 7.10.0. No live database migration has been applied. Empty migration directories are not a migration history.

| Entity | Purpose |
| --- | --- |
| User, Session, Account, Verification | Auth provider identities, sessions and expiring verification/reset records |
| Business, Membership | Company settings, workspace ownership and user roles |
| Contact | Reusable clients/suppliers within one business |
| Invoice | Issued/received financial record, dates, currency, totals and party snapshots |
| InvoiceBlock | Ordered narrative charges; optional quantity/rate for legacy samples |
| Payment | Actual payments used to calculate the remaining balance |
| UploadedDocument | Private object key, MIME, hash, size and processing state |
| ExtractionResult | Unconfirmed structured candidate, raw text and confidence |

Before the first migration, add reviewed SQL constraints for nonnegative charges/payments, positive document sizes, valid tax basis points (0–10,000), invoice total = subtotal + tax, due date >= issue date, supported currencies, and the issued invoice number uniqueness rule. Prisma does not express every PostgreSQL CHECK or partial index in its schema.

Confirm imported totals with the user. Preserve provider candidates separately from confirmed records. Never silently repair a mismatch between the document and calculated amounts.

Membership and business filters are mandatory on every server query, including document/extraction joins. Foreign keys enforce relationship consistency but do not authenticate the caller. Access-control tests must prove that IDs from another business cannot be read, updated, exported or attached.

Financial records use archive/cancel in normal flows. Avoid deleting memberships referenced by invoices; disable access instead. A separate audited data-retention/deletion workflow will be required before public launch. Audit events and export jobs will be added when those services are implemented, rather than creating unused tables now.

Browser drafts are not automatically database records. Provide an explicit validated import after login, recompute totals server-side, preserve content/order, and show a review before transfer. Never clear local drafts until the server confirms successful import.
