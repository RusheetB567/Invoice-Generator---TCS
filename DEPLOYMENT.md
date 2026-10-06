# Deployment gate
Hosting and accounts are intentionally deferred. No service was deployed.

Production startup requires an explicit HTTPS origin, strong auth secret, configured PostgreSQL, private versioned S3, private ClamAV socket, verified email delivery configuration, legal operator/privacy contact and an operator approval flag. The flag is an operational acknowledgement, not evidence of security.

Before public access, use [OPERATIONS.md](OPERATIONS.md). Run reviewed migrations with a separate role and `npm run check:production` with NODE_ENV=production and private configuration. That script tests connectivity/migrations, critical history/schema privileges and bucket public-access/encryption/versioning configuration. It does not certify database residency, network isolation, scanner health, mail delivery or restore success.

A scanner with Unix-domain socket or Windows named-pipe access is required by the current adapter. Select a compatible application runtime or implement and test a private authenticated scanner adapter before choosing a hosting model. Do not expose ClamAV TCP or public database ports.

No Git staging, commits, pushes, remote writes or deployments are part of this delivery.

