# Backend security review — 6 October 2026

This review describes source and local tests, not approval of a deployed service. The Desktop application and the isolated `backend-stage` review copy are distinct; backend changes are being prepared in the latter. No commits or deployments are authorised.

## A. Architecture
The application is Next.js with Better Auth password authentication, server membership checks, invoice services and immutable revision history. The review implementation supports local PGlite for development and PostgreSQL with certificate verification for production. Private local originals or versioned S3 objects are accessed through authenticated server routes. Spreadsheet ingestion and PDF creation run on the server. No production database, bucket, email domain, scanner or hosting account has been selected.

## B. Exposure
Public pages are the landing page, sign-up, sign-in, account recovery and privacy information. Authentication needs an explicit HTTP endpoint allowlist: enabling a library feature must not silently expose unrelated identity operations. Private routes require current database membership. Browser financial storage is replaced by server persistence with an explicit legacy import.

## C. Critical risks
Before this hardening pass, exports used the ordinary read guard, permissions largely distinguished only viewers and writers, and sensitive operations had no strong reauthentication. MFA was absent. Production configuration deliberately fails closed. Five high severity development-tool dependency advisories remain in the braces/micromatch lint chain; no patched upstream braces version was available at the dependency check. This is a residual risk, not a clean security assessment.

## D. Authentication and sessions
Better Auth owns password hashing, session cookies, expiry, password reset and verification. Cookies are HttpOnly; production uses HTTPS. Session data is fetched from the database rather than trusted browser claims. Password reset expires and revokes sessions. Only configured email delivery enables recovery; no email was sent during tests. Session tokens must not be returned in the public JSON API.

## E. MFA and passkeys
Implement the installed Better Auth TOTP plugin with password-confirmed enrollment, confirmation before activation, encrypted secrets, one-time recovery codes and account lockout. Add server proof tied to the exact session and replay rejection. Recovery codes permit account recovery but do not provide recent strong assurance for exports or security changes. Require MFA for production owners/admins. Passkeys remain planned: use the official plugin, a fixed verified RP domain/origin and required user verification, then test real browser enrollment and recovery before enabling them.

## F. Permissions
Introduce explicit permissions with deny-by-default role mapping and server checks. Owner/admin manage business settings and exports; members create/review invoices; viewers read permitted workspace data. Unknown roles receive no permissions. Role assignment and membership administration are not exposed. Removing a navigation entry alone is not access control. Sensitive audit/settings data needs stronger permissions than ordinary invoice reads.

## G. Step-up matrix
Invoice creation/review: authenticated session and write permission. Archive: archive permission. Spreadsheet/workspace exports, payment detail changes, password changes, MFA removal and recovery-code regeneration: permission plus TOTP proof no older than ten minutes. Production privileged MFA cannot be removed without a replacement mechanism. Account recovery does not remove MFA. Revoking other sessions remains available to contain compromise.

## H. Network
Target: HTTPS client -> application -> private PostgreSQL; application -> private versioned object storage, private malware scanner and configured email API. This is a target topology, not a discovered network. Default local development binding should be loopback. Actual TLS termination, firewall rules, DB/bucket public exposure, DNS ownership, egress, WAF and management ports must be verified after providers are chosen. Forwarded client headers are not a source of identity or role authority.

## I. Data and documents
Validate request sizes and financial totals on the server; keep tenant IDs derived from membership. Original files are quarantined before scanning/extraction, versioned or immutable, checked by checksum and served privately. Local no-scanner development is explicitly not malware clearance. Append-only revisions/audit records preserve evidence. Encrypted local backup restore was tested with synthetic data; production backup/restore and residency remain unverified. Retention and deletion need operator review, not automatic removal of tax evidence.

## J. Administration
Personal account security must be available without organisation-admin privileges, including MFA bootstrap. Business preferences, exports and audit data have separate permissions. No global admin dashboard, impersonation, API-key management or membership invitations are implemented. Database operators remain external; deployment must use a migration role distinct from the restricted application role.

## K. Monitoring and incidents
Session events and financial changes are auditable without raw tokens, passwords, recovery codes or document content. Add MFA/security events. External alerting and protected log retention are not configured. Incident response: revoke affected sessions; contain exposed services/keys; preserve evidence; assess tenant/data impact; follow operator notification obligations; restore verified backups; document and retest remediation. No penetration test or formal compliance certification has been performed.

## L. Priorities and acceptance evidence
First: permissions, public auth allowlist, TOTP and session-bound recent proof. Next: usable security/sign-in screens and negative tests for replay, recovery, stale proof, tenant access and low privilege exports. Then: clean type/lint/build, complete regression suite and synthetic HTTP flow. Provider selection follows, then real PostgreSQL/S3/scanner/email/backup/network verification and independent security testing. Launch remains blocked until those operational controls and legal privacy details are evidenced.

References: [Better Auth MFA](https://better-auth.com/docs/plugins/2fa), [passkeys](https://better-auth.com/docs/plugins/passkey), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP authorisation](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
