# Development workflow

Keep the Desktop `invoiceflow` project as the main application; `landing-stage` is the review copy. Back up source files before applying reviewed changes. Do not copy `.next`, dependency junctions, browser data or screenshots into the application.

Current checks: ESLint, TypeScript, production build, calculation tests, desktop/mobile UI checks and local save/reopen compatibility. The tests use Node's built-in runner, with process isolation disabled for this Windows environment.

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run build -- --webpack
```

## Next milestone: database and authentication

1. Choose local or hosted PostgreSQL. Configure its connection privately in `.env`; do not paste passwords into chat.
2. Install matching Prisma 7 CLI/client and PostgreSQL adapter versions. Configure `prisma.config.ts` using the official guide and verify connection pooling for the selected host.
3. Validate the schema, create a reviewed initial migration with the constraints listed in DATABASE.md, and run it against an empty development database. Commit the schema and migration together.
4. Install/configure Better Auth and an email transport; generate secrets locally without logging them. Add server session checks and memberships before exposing database CRUD.
5. Test registration/login/logout/reset, session expiry and cross-business access. Verify the UI-to-database flow with two distinct users/businesses.

Suggested milestone commit after source review: `feat: refine TCS invoice studio and establish SaaS foundation`.

Do not stage unrelated user changes, commit secrets or treat schema validation as proof that a live migration succeeded.
