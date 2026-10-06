# Backend architecture
Next.js App Router provides pages and route handlers. Better Auth with Drizzle owns passwords, email verification, reset tokens, sessions and encrypted TOTP/recovery data. Current membership is fetched on every protected operation; browser role claims have no authority.

Application services use a shared SQL abstraction: PGlite for one-process local development; pg Pool with certificate-verified TLS for hosted PostgreSQL. Reviewed additive migrations are applied automatically only to local development. Production runtime does no schema DDL.

Created invoices are validated and totals recalculated in integer cents. A workspace row lock serialises number allocation and revisions. Each change adds an immutable invoice snapshot and audit event; archive retains history. Preferences have expected revisions. The browser hydrates a memory cache from server state and never falls back to browser financial writes after hydration.

Original documents are stored privately before scan/extraction. Private object metadata binds workspace, object/version, size and SHA-256. Blocked objects cannot be downloaded. Excel imports retain their exact workbook and commit reviewed rows atomically. Generated PDFs preserve the saved issuer/customer/body/branding snapshot and have one canonical object per revision.

## Target hosted topology (not deployed)
HTTPS client -> application -> private PostgreSQL; application -> private versioned S3, private ClamAV IPC and email API. Identity/session/permission/recent-assurance checks precede resource access. Database and objects are not served directly to browsers. A host supporting the selected scanner transport must be chosen; do not assume every serverless host supports this topology.

There is no membership invitation, global admin, impersonation, payment processing or live reminder service. Original source PDFs are evidence, not executable templates. Arbitrary user HTML/JavaScript is not accepted.

