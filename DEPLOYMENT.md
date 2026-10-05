# Deployment readiness

The application currently runs locally. The repository was previously pushed to GitHub. This account/workspace milestone is left uncommitted and unsynced for the user to review. No hosting deployment, paid account or email delivery has been performed.

Before a public release: configure PostgreSQL and connection pooling, apply reviewed migrations, enable secure authentication and tenant isolation, configure private object storage, configure verified email delivery, run integration/access-control tests, test database/object recovery, and replace browser-only demo features with their verified server implementations.

Vercel remains the intended Next.js host. Its filesystem cannot serve as persistent upload storage. Configure secrets through the deployment environment, never through committed files. Use a separate development database and storage bucket from production. Run production migrations as a controlled release step, not during arbitrary requests.

Do not label the existing print dialog as direct server-generated PDF download or reminder preferences as active email automation.

