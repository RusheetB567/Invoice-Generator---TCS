# Backend operations

## Local review
Restart the existing development server after applying backend source. Use one process for each INVOICEFLOW_DATA_DIR; do not run migration/backup tools against a live local PGlite directory. No production credentials are needed for development. Visit Account -> Security to enroll an authenticator before exporting or changing payment details. Setup/recovery codes are shown only during initial enrollment or deliberate regeneration; store them privately.

The default dev server listens on 127.0.0.1. If using localhost in the browser, use http://localhost:3000 as BETTER_AUTH_URL; if using 127.0.0.1, configure that exact origin instead. Never trust an arbitrary forwarded-host header to select the application origin.

## Local encrypted recovery
Stop all application processes that use the local directory. Configure a private 32-byte key as 64 hex characters and set INVOICEFLOW_OPERATOR_APP_STOPPED=true for the operator process only. Run `npm run backup:local -- create <new-backup-path>`; do not put the key on the command line. Keep the key in separate protected recovery storage. The backup includes database, originals and the local authentication signing key inside authenticated encryption.

Restore with `npm run backup:local -- restore <backup-path> <new-empty-directory>`. Existing targets are refused. Start a separate local installation with INVOICEFLOW_DATA_DIR pointing to the restored directory and verify accounts, record counts and representative original hashes/PDFs before switching. Test recovery regularly. Hosted PostgreSQL/S3 need provider-specific encrypted backup, lifecycle and restore procedures; the local utility is not a production backup service.

## Hosted rollout (pending provider choice)
1. Inventory host, database, bucket, scanner, email, DNS/TLS, backup and log services with owners and regions. Verify residency rather than infer it from a region label.
2. Configure HTTPS and private connectivity. Restrict database ingress to the application/operator path, require certificate verification, keep management ports private, verify egress and provider proxy/IP trust. Do not expose scanner TCP.
3. Use a separate migration role; back up before `npm run db:migrate -- --apply`. Give the runtime only required DML and audit/revision INSERT/SELECT privileges. Remove schema CREATE and evidence UPDATE/DELETE privileges. Never supply migration credentials to runtime.
4. Provision private versioned encrypted storage. Check bucket policies, all public-access blocks, object access and version permissions. No public invoice bucket or permanent document URLs. Before migrating old local records, map source IDs/workspaces/checksums and test a scoped versioned copy; no automatic data migration is implemented.
5. Verify scanner clean/blocked/error behavior on uploaded PDF/image/XLSX and generated PDF paths. Verify delivery, expiry, reuse and session revocation for real verification/reset emails.
6. Run `npm run check:production` with NODE_ENV=production and private configuration. It intentionally fails without required settings. Passing is limited to its explicit checks; provide separate network, residency, scanner, email, backup and incident evidence.
7. Confirm privileged users enroll MFA. Configure protected logs and alerts for repeated failures, blocked uploads, sensitive exports and privilege changes. Verify alert delivery with synthetic events.
8. Complete independent security testing and legal/privacy review before acknowledging INVOICEFLOW_PRODUCTION_APPROVED=true and enabling public access.

## Incident playbook
For suspected credential theft: revoke affected sessions via operator access, suspend exposure as appropriate, rotate affected provider/application keys through approved secret management, and preserve metadata. For a document leak: remove public exposure, preserve versions/audit, enumerate affected scoped IDs, assess lawful notification and verify access controls before reopening. For malware/scanner outage: uploads fail closed; repair scanner privately and rescan quarantined objects through a reviewed process. For data corruption: isolate the write path and restore into a separate environment, verify evidence hashes/counts and reconcile later records before cutover.

No operator impersonation, automatic purge, emergency admin HTTP route or provider credential display exists. Keep response ownership and escalation contacts outside the app until a secured operator system is implemented.
