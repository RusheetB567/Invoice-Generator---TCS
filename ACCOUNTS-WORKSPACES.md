# Accounts and private business workspaces

## Working flow

Public landing → sign up with first name, last name, email and password → account/session created → name the business workspace → organisation onboarding → private dashboard. Returning users sign in and continue unfinished setup or enter their dashboard. Sign out revokes the server session and performs a full navigation to discard private client route caches.

Email verification remains **deferred** as requested. The account stores `emailVerified=false`; no verification or recovery emails are sent. The UI explains this. Email changes, social login, invitations and MFA are not implemented.

## Runtime architecture

Better Auth 1.7.7 handles password hashing, sessions, cookies, password changes and other-session revocation. Its official Drizzle adapter connects to the existing embedded PostgreSQL development database. This avoids requiring a paid provider or a separately installed PostgreSQL server to test the complete local flow.

`lib/server/auth-schema.ts` is the live auth mapping. `lib/server/account-migration.ts` is the additive local SQL migration; it runs transactionally once per process/schema version and preserves pre-account records. `prisma/schema.prisma` is the broader future domain design, **not** the applied runtime schema. Do not apply it on top of this database without a reviewed reconciliation migration. Pick one production ORM/schema source before the cloud release.

One business workspace per account is supported in this milestone. Memberships have OWNER, ADMIN, MEMBER and VIEWER roles. Creation provisions OWNER. The interface does not yet provide membership invitations or role management. Workspace creation locks the user row, and uniqueness prevents duplicate creation on parallel requests.

## Private data and access

- Private page layouts verify the server session and require completed organisation onboarding.
- Every document list, preview, original download, confirmation and Excel export resolves membership on the server and queries by workspace. Viewer writes are rejected.
- Deduplication is per workspace; identical files in different businesses receive independent IDs.
- Business profiles, client/supplier directories and tax questions persist in PostgreSQL. Questions are a private notebook; they do not contact the ATO or an accountant.
- Contacts support editing, search, archiving and restoring. Selecting a directory client copies its name/address into the invoice; subsequent directory edits do not rewrite that invoice.
- Creator drafts, logos, brand preferences and reminder preferences remain **browser-local**, keyed by account plus workspace. They are not cloud backups or shared team invoice records. A hydration barrier selects the storage scope before mounting editors.
- Old unscoped browser values and pre-account documents are preserved, but excluded from new accounts. They require a future explicit import/assignment workflow; the first signup does not automatically gain access to them.

Onboarding supplies business name, address, business number, country, currency, GST registration, accent and payment defaults. Brand Studio can continue personalising invoice appearance. New invoices keep narrative billing bodies; the original TCS table is still an explicitly selected sample.

## Configuration and deployment boundary

Run `npm run dev`, then open `/sign-up`. Authentication currently permits localhost in development/test only. The production build compiles, but private runtime operations deliberately fail closed until managed PostgreSQL, private object storage and the production adapter are implemented. This is a working local SaaS foundation, not a publicly deployed multi-user service.

If `BETTER_AUTH_SECRET` is set it must contain at least 32 characters. Otherwise development generates a random persistent secret in the ignored `storage/tax-vault/auth-secret` file. Never commit or share that file. On Windows protect the complete storage directory with the owner's filesystem ACL; POSIX file modes alone do not configure Windows permissions. Back up the full directory while the process is stopped, including originals, database and signing secret. Never run two application processes against one PGlite directory.

`BETTER_AUTH_URL` is optional locally; when set, it must match the exact origin. Main uses `http://localhost:3000`; review uses `http://localhost:3100` with separate storage. No trusted cross-origin wildcard is configured. Library cookies are HttpOnly/SameSite=Lax; HTTPS secure cookies and durable distributed rate limiting must be verified with the production host. Auth endpoints enforce a 16 KB JSON limit. Other structured mutation endpoints have streamed limits and same-origin checks. Auth error logging is disabled because adapter messages can contain SQL parameters; application errors expose safe messages.

## Verification

`npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build -- --webpack`.

Integration fixtures verify real signup, duplicate email handling, hashed passwords, wrong-password rejection, unfinished-onboarding exclusion, workspace creation, profile completion, cross-business file/read/confirm isolation, per-business deduplication, preserved unassigned evidence, viewer write rejection, contact isolation/archive/restore, account name edits, password change and session revocation. Separate tests cover browser-scope isolation, streamed JSON limits, exact signed money formatting and existing tax/upload/Excel/persistence regressions. Browser review covers sign-in → onboarding → private dashboard and a saved client, alongside signup layout and mobile spacing.

No commit, push or sync is performed for this milestone. Review the application and source diff, then commit and sync manually.

Official integration references: [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication), [Drizzle PGlite driver](https://orm.drizzle.team/docs/connect-pglite).
