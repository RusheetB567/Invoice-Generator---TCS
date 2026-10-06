# TCS InvoiceFlow
Invoice creation and reviewed financial records by The Code Squad.

The backend now saves creator invoices, branding and reminder preferences on the server, with workspace isolation, optimistic revisions and retained history. Signup, onboarding and sessions use Better Auth. Authenticator MFA protects sign-in and sensitive exports/payment/security changes. The UI offers narrative billing bodies for fresh invoices and retains older table templates.

Uploads are quarantined before reading; PDF/image extraction and Excel imports require review before records become confirmed. Excel exports and generated PDFs are private server downloads. Reminder configuration does not send reminders or collect payments.

## Local development
Use Node 24 LTS. Install dependencies with `npm ci`, then `npm run dev`. The server binds to 127.0.0.1 and is accessible at http://localhost:3000. Configure BETTER_AUTH_URL to the exact browser origin if using another hostname/port. Run one process per data directory. Stop the previous server before restarting after backend changes.

Run `npm run test`, `npm run lint` and `npm run build`. Local development uses embedded PostgreSQL and private files in ignored storage/tax-vault. No configured email service means local verification/recovery email is unavailable. Local files without a scanner are not certified malware-free.

Older browser drafts remain untouched. Import them explicitly after signing in. Drafts already saved on the server are skipped; invalid imports remain on the original device.

## Production status
Hosting has not been chosen. PostgreSQL, versioned private S3, scanner and email adapters exist, but live services, residency, backups and network controls remain unverified. Production fails closed until the documented prerequisites are configured and operator checks are completed. No formal compliance approval or penetration test is claimed. Passkeys are planned, not enabled.

Start with [BACKEND-DELIVERY.md](BACKEND-DELIVERY.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [OPERATIONS.md](OPERATIONS.md), [API.md](API.md) and [DATA-PROTECTION.md](DATA-PROTECTION.md). All source changes are left for the owner to review, commit and sync.

