# Backend threat model and residual risk

Trust boundaries: browser -> public auth/application routes -> current session/membership/permission/assurance -> workspace SQL and private originals -> scanner/email/storage providers. Request headers, uploaded documents and extracted text are untrusted. Uploaded text is never an instruction to the server.

| Threat | Implemented control / evidence | Residual work |
|---|---|---|
| Cross-tenant ID substitution | Current membership and scoped SQL; negative invoice/workbook/document tests | Hosted database/RLS review; team-invitation tests when added |
| Role escalation/export abuse | Explicit permission map; deny unknown roles; member/viewer negative tests | Finer document classifications and additional finance roles |
| Stolen password/session | TOTP, session-bound proof, recent strong verification, revoke/reset tests | Passkeys, real browser recovery testing, external detection |
| Replayed/expired MFA or recovery | Keyed replay tracking, library one-time recovery/challenge expiry/lockout; real facade tests | Operator-assisted lost-factor recovery procedure |
| Forged financial totals/lost updates | Strict validation, integer cents, expected revisions and atomic numbering | Large-history paging/full exports |
| Evidence alteration | Append-only triggers, immutable revisions/original versions, integrity/restore tests | Verify restricted runtime role and hosted backup/object retention |
| Hostile uploads/parser exhaustion | Byte/signature/dimension limits, bounded ZIP/XML, scan-before-parse, blocked access | Live scanner and parser isolation/resource budgets under chosen host |
| Injection/CSRF/cache leak | Parameterised SQL, text rendering, origin checks, token-free JSON/no-store | Full nonce CSP and deployed cache/proxy review |
| Public storage/database exposure | Private server downloads; TLS/S3 adapters and readiness checks | Provider firewall/IAM/bucket policy evidence; no deployment exists |
| Supply-chain compromise | Runtime uuid advisory removed; lockfile retained | Five high dev-tool advisories unresolved upstream; monitor fixes |
| Backup/key loss or breach | Authenticated encrypted local backup and synthetic restore | Production schedules, key custody, recovery drill and incident ownership |

This provides evidence toward OWASP authentication, authorisation, validation and logging controls. It does not establish complete ASVS compliance or Australian Essential Eight maturity. External penetration testing must include auth/MFA recovery, tenant boundaries, financial state changes, private document routes, spreadsheet parser limits and deployed network controls.
