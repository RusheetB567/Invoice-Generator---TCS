# Backend core delivery — 6 October 2026

Implemented: PostgreSQL/local adapters and reviewed migrations; server invoice persistence/revisions/numbering/totals; private original storage/quarantine/integrity; reviewed spreadsheet imports and permission-protected exports; canonical saved PDF revisions; business preferences with conflict protection; production email hooks; encrypted local backup/restore; privacy review requests; session/MFA/security audit; allowlisted authentication routes; real authenticator MFA with one-time recovery, replay controls and recent sensitive-action verification.

The current roles are OWNER/ADMIN/MEMBER/VIEWER. Current database membership controls authority. Production owners/admins must enroll MFA; enabled sessions need server proof. Recovery restores ordinary access but cannot approve exports/payment/security changes. Personal security remains accessible to complete setup. The interface reveals verification only when needed and hides exports from roles without permission.

## Verification
The regression suite includes 56 tests, covering real authentication facade enrollment/recovery/replay/stale proof, tenant isolation/role denial, financial tampering and conflicts, scanner quarantine/integrity, exact originals and spreadsheet roundtrips, PDF text/page breaks, encrypted recovery/corruption rejection, email verification/reset expiry/reuse/revocation with mocked delivery, and existing tax/appearance/navigation behavior. Final run results are recorded in the chat.

Local HTTP smoke covers private redirect, signup/onboarding, saved invoice/reload/PDF, headers and sign-out revocation. PDF layouts were inspected through local rendering. Browser interaction automation was unavailable; visual/click-flow review remains necessary. No real emails were sent and no live hosted database/bucket/scanner was provisioned or verified.

## Review and launch constraints
All changes are left uncommitted. Restart local development before reviewing Account security and export approval. Existing financial browser drafts remain untouched; explicit import may require authenticator verification when payment details differ.

Production remains gated. Provider choice, private network/IAM, actual residency, delivery, scanner, backups/restore, legal operator/privacy contact, external monitoring and penetration testing require evidence. Passkeys, fine-grained confidential-document classifications, extra finance roles and complete historical/privacy exports are pending. Five high dev-tool dependency advisories remain. Do not present this build as production-approved, formally compliant, or penetration-tested.

Read [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [THREAT-MODEL.md](THREAT-MODEL.md), [DATA-PROTECTION.md](DATA-PROTECTION.md) and [OPERATIONS.md](OPERATIONS.md) before rollout.
