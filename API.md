# Backend API
All private endpoints use current server sessions and membership, no-store responses, scoped resource IDs and bounded request bodies. Mutations require the exact trusted origin. Unknown auth endpoints are denied.

- /api/auth: allowlisted signup/signin/signout, account name updates, verification/reset callbacks, password changes, revoke-other-sessions and TOTP enrollment/verification/recovery/disable/code regeneration. Secrets/recovery codes are returned only during enrollment or an approved regeneration. Session tokens are removed from public JSON.
- GET /api/account/security: personal MFA/recent-proof state and sanitised own session metadata; no session token, TOTP secret or stored recovery codes.
- GET/POST /api/workspace: workspace onboarding/profile; changed payment details require recent TOTP.
- GET/POST /api/workspace/state: creator drafts/summary and business defaults; preferences require business.manage, payment changes also recent TOTP.
- POST /api/invoices: validated create/update with expected revision; number allocation and totals are server-owned. Changed invoice payment instructions require business.manage and recent TOTP.
- GET/DELETE /api/invoices/[id]: scoped snapshot/archive. Archive requires invoice.archive; history remains.
- GET /api/invoices/[id]/pdf: private canonical PDF for the saved revision.
- /api/vault and /api/vault/[id]: quarantined upload, metadata, review/confirmation, private source and bounded preview.
- /api/vault/imports and /api/vault/imports/[id]: private Excel upload, mapped review and atomic confirmation.
- GET /api/vault/template: blank safe Excel import template.
- GET /api/vault/export: records.export plus recent TOTP; reviewed confirmed records only.
- GET/POST /api/workspace/privacy: administrator summary export with recent TOTP; review requests do not delete evidence or send email.
- POST /api/tax/calculate: authenticated calculation with year/mode validation. No tax lodgement.
- Existing contacts/enquiries endpoints remain private with read/write guards; these enhanced areas remain outside standard navigation.

Errors: 401 sign-in, 403 permission/MFA/step-up, 409 revision conflict/replayed code, 413 size, 422 validation, 429 attempt limits, 503 missing production service. Sensitive actions return STEP_UP_REQUIRED without financial payload. Reauthenticate and retry; never bypass that error in a client.

