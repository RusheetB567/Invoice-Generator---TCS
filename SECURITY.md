# Security implementation and limits
See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the pre-hardening review and [BACKEND-DELIVERY.md](BACKEND-DELIVERY.md) for verified delivery.

Authentication uses Better Auth with password-confirmed TOTP enrollment, confirmation before activation, encrypted secrets/recovery codes, one-time recovery, persistent attempt controls and challenge lockout. Successful TOTP is tied to the exact server session; keyed code digests reject replay for two minutes. Privileged production roles require MFA. Sensitive exports, payment changes, password changes, MFA removal and code replacement require TOTP no older than ten minutes. Recovery sign-in cannot approve those actions. Production administrators cannot disable their only configured MFA.

Permissions explicitly deny unknown roles. OWNER/ADMIN can manage business preferences, archive and export; MEMBER creates/reviews records; VIEWER reads workspace invoice/record data. Existing invoice/document read permission includes full financial document content within that workspace. Fine-grained confidential-document classifications, Accountant/Finance roles, membership administration and per-document sharing are not implemented; do not claim those controls or onboard teams needing them.

Server role and tenant checks protect every route. MFA-locked server layouts redact business profiles; the personal security area permits enrollment without unlocking financial records. Sessions and MFA operations are audited without raw credentials. SQL parameters, byte limits, validated logos/files, formula-safe spreadsheets and computed totals prevent common injection/tampering paths. Append-only history is enforced by database triggers, with a separate restricted runtime role required in production.

Headers include nosniff, frame denial, referrer/permissions restrictions, baseline object/base/frame/form CSP and production HSTS. Powered-by and production browser source maps are disabled. Full nonce-based script CSP is not implemented. CSRF/origin checks and no-cache responses are tested; actual proxy/client-IP trust still needs provider-specific verification.

Originals are quarantined before parse, scanned through private IPC, private/versioned, bounded and integrity-checked on access. Local validation without ClamAV is not malware scanning. Runtime roles must not delete evidence. Backups are encrypted locally; live provider backups/restore have not been tested.

Known residuals: five high dev-tool advisories in the braces/micromatch lint dependency chain; no patched upstream braces version was available at verification. No formal pentest, deployment network verification, external alerting, passkeys, granular sensitive-document policy, production restore drill or formal Australian compliance assessment. These are launch constraints, not certifications.

