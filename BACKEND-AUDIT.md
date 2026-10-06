# Backend audit and implementation plan — 5 October 2026

## Current architecture and evidence

Next.js 16.3.8 App Router, React 19.2.8 and strict TypeScript form one application. Better Auth 1.7.7 uses the Drizzle PostgreSQL schema, salted password hashes and database sessions. Every existing private route has a server layout calling `privateWorkspace`; APIs resolve a session and current membership. Authentication is not disabled in development. Local HTTP checks and the existing account integration tests deny unauthenticated access and foreign-workspace documents. The supplied brief's claim that all private routes are open is therefore not accurate for this revision.

The database is embedded PostgreSQL (PGlite) in ignored local storage. Original PDFs/images/workbooks are retained on the same computer and served through authorised ID lookups. Text extraction and Tesseract OCR run locally, require user review and do not automatically claim GST. Excel exports and uploaded tax records are persistent, scoped and server validated. The tax calculator has a versioned integer-cent domain engine and an authenticated calculation API. No public hosting, managed database, email delivery, malware scanner or cloud bucket is configured.

## Persistence and security findings

| Area | Existing implementation | Gap |
| --- | --- | --- |
| Created invoices | Validated, account/workspace-scoped localStorage | No authoritative server save, revisions, numbering or persistence across devices |
| Branding / reminder preferences | Browser persistence | Not shared business data; reminders correctly do not claim to send emails |
| Sessions / profiles | Real local database / Better Auth | Local-only configuration; verification/reset delivery unavailable; rate limiting currently per process |
| Membership | Server queries, four roles | One membership per user; coarse writer rule; no central action policy |
| Document originals | Local private directory, UUID lookup | Stateless hosting unsupported; parsing precedes a malware scanner |
| PDF output | Browser print dialog | No deterministic server PDF or retained versions |
| Financial totals | Pure integer engine in creator | Browser totals not verified on save because there is no server invoice save |
| Uploads / Excel | Signature, size, dimensions/ZIP bounds, review | Production scan/quarantine, private object storage and audit lifecycle missing |
| Logs / retention / recovery | Safe generic errors, no automatic evidence deletion | No append-only business audit; no retention policy workflow; no tested managed recovery |
| Infrastructure | Example variables, ignored secrets/storage | Production environment validation, controlled migrations, private bucket verification, health/CI gates missing |

Marketing preview/sample invoices are intentional demonstrations, not saved financial records. Tax suggestion metadata stores only a bounded engagement count/index. Theme preference stores only light/dark. Temporary editor state is unsaved work. Browser auth tokens are not used. No secret values are read or included in this audit. A secret-pattern/history review and dependency audit will be recorded separately.

## Target design and credentials

Browser → server session → verified membership/action → bounded Zod input → financial/document service → transaction → PostgreSQL + audit. Files use a private S3-compatible storage interface and authorised streamed downloads. PostgreSQL remains authoritative; local PGlite remains a development adapter. Drizzle/Better Auth are retained rather than installing a second identity framework or switching to the unused Prisma scaffold.

Core relationships: auth user → memberships → business workspace → created invoice / charge sections / branding / preferences / uploaded documents / workbook batches / PDF versions / tax records / privacy requests / audit. Invoice revisions and unique workspace/number constraints prevent silent overwrite and duplicate numbering. Created invoice snapshots retain the seller/customer/visual data needed to reconstruct versions; line/section charges and authoritative totals remain separately validated.

Password hashes and sessions remain in restricted auth tables. Database URL, auth signing secret, email API key and storage credentials remain server-only environment/secret configuration; never NEXT_PUBLIC values or logged values. AWS SDK credentials use its supported provider chain, with scoped roles preferred. Production requires TLS and an exact HTTPS origin. Verification/reset use Better Auth token handling and a configured transactional mail adapter; no real email is sent during development verification.

Private original objects use generated workspace/UUID keys. Metadata stores provider/key/version/hash/size, not public URLs. Authenticated file routes resolve these keys after tenant checks. Safety checks precede extraction; rejected/unscanned files do not become trusted downloads. PDF versions are generated from a server-verified invoice revision and stored privately. Upload and application secrets never live in public assets.

## Compliance status before this change

Implemented technical controls: server authentication, tenant filters, safe financial arithmetic, bounded invoice review, original provenance. Partial: account access/correction, document evidence integrity and session management. Missing: audit lifecycle, configurable retention, private cloud adapters, verified recovery and incident runbooks. Needs business input: legal operator/contact, vendors/regions, backup RPO/RTO, retention classifications and support ownership. Needs legal/applicability confirmation: Privacy Act/APPs/NDB, any state obligations and customer contracts. No formal compliance or Australian residency claim is made.

## Exact implementation scope

Create server database/config/storage/scanning/permissions/audit/rate-limit/invoice/PDF/preferences/retention services, controlled SQL migrations and release scripts. Add authenticated invoice/preference/audit/privacy endpoints and integrate creator/library/branding/reminder/dashboard clients with server state. Preserve browser data for an explicit migration review rather than silently trusting or deleting it. Extend auth and guard configuration for a provisioned production environment. Add default route protection/security headers, verification/reset UI, health checks, CI tests and operational/privacy/recovery documents.

Packages: `pg` + types, AWS modular S3 client, `pdf-lib` and its fontkit adapter. Bundled licensed static PDF fonts avoid runtime font downloads. Environment names: runtime mode, DATABASE_URL/TLS CA, BETTER_AUTH_URL/SECRET, private storage region/bucket/endpoint, scanner connection, transactional mail/from, operator/contact. No credential values enter source.

External resources still need operator setup: PostgreSQL with restricted runtime and migration roles, private encrypted/versioned bucket, private scanner, verified email domain, separate staging environment, monitored encrypted backups and a restoration exercise. These can be coded and tested with disposable fixtures; live provisioning, residency verification and deployment depend on the selected accounts. Deployment will not be claimed as completed without those checks. Git commits and sync remain the user's responsibility.
