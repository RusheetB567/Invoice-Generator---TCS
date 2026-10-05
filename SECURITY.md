# Security delivery requirements

The current build is a local browser prototype. It has no authenticated server record API. These controls are acceptance criteria for the shared service, not claims about completed implementation.

- Authenticate on the server and resolve authorised business membership for every operation. Never trust a client-provided user/business ID by itself.
- Use the auth library for password hashing, secure cookies, session rotation and verification/reset token handling. Require verification before production access.
- Validate request schemas, lengths, dates, currencies and monetary inputs. Recompute totals on the server; reject inconsistent data.
- Use optimistic revisions for edits and transactions/locking for invoice numbering, payments and extraction confirmation.
- Keep document objects private. Authorise downloads and use short-lived URLs. Validate signatures, supported formats, size/page limits and decompression limits; reject unsafe uploads.
- Render custom text safely. Future template JSON must have an allowlisted schema; never execute customer JavaScript or inject arbitrary HTML.
- Configure rate limits and auth CSRF/origin protections before public exposure. Use generic safe error messages and redacted technical logs.
- Never log secrets, session tokens, complete bank details or raw uploaded invoice contents.
- Back up database/object storage; test restoration and retention workflows. Audit material changes once server writes exist.

Automated access-control, upload, authentication and integration tests are required before deployment with real user data.
