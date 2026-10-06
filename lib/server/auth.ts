import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/pglite";
import { drizzle as postgresDrizzle } from "drizzle-orm/node-postgres";
import type { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { applicationOrigin, assertProductionConfigured, production } from "./config";
import { emailConfigured, sendAccountEmail } from "./email";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { database, dataDirectory, VaultError } from "./vault";
import * as schema from "./auth-schema";
import { z } from "zod";

export async function signingSecret() {
  if (process.env.BETTER_AUTH_SECRET) {
    if (process.env.BETTER_AUTH_SECRET.length < 32)
      throw new VaultError(
        "Authentication requires a secret of at least 32 characters.",
        503,
      );
    return process.env.BETTER_AUTH_SECRET;
  }
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test")
    throw new VaultError(
      "Authentication is not configured for this environment.",
      503,
    );
  const filename = path.join(dataDirectory(), "auth-secret");
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const secret = randomBytes(48).toString("base64url");
    try {
      await writeFile(filename, secret, { flag: "wx", mode: 0o600 });
      return secret;
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST")
        throw writeError;
      return readFile(filename, "utf8");
    }
  }
}
async function createAuth(origin: string) {
  const client = await database();
  return betterAuth({
    appName: "TCS InvoiceFlow",
    baseURL: origin,
    secret: await signingSecret(),
    plugins: [twoFactor({ issuer: "TCS InvoiceFlow", skipVerificationOnEnable: false, accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 } })],
    database: drizzleAdapter(client.kind === "local" ? drizzle(client.native as PGlite) : postgresDrizzle(client.native as Pool), {
      provider: "pg",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: production() || emailConfigured(),
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      ...(emailConfigured() ? { sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => sendAccountEmail(user.email, url, "reset") } : {}),
    },
    ...(emailConfigured() ? { emailVerification: { sendOnSignUp: true, expiresIn: 3600, sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => sendAccountEmail(user.email, url, "verify") } } : {}),
    user: {
      additionalFields: {
        firstName: {
          type: "string",
          required: true,
          validator: {
            input: z.string().trim().min(1).max(80),
          },
        },
        lastName: {
          type: "string",
          required: true,
          validator: {
            input: z.string().trim().min(1).max(80),
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-up/email": { window: 60, max: 5 },
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
        "/two-factor/enable": { window: 60, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "tcs-invoiceflow",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    // Adapter errors can include SQL parameters; never log credentials or account fields.
    logger: { disabled: true },
  });
}
const state = globalThis as unknown as {
  invoiceAuth?: Map<string, ReturnType<typeof createAuth>>;
};
export async function getAuth(origin: string) {
  assertProductionConfigured();
  const url = new URL(applicationOrigin(origin));
  const key = `backend-v3:${dataDirectory()}:${url.origin}`;
  // Ensure additive migrations also run when Next.js reuses an auth singleton after HMR.
  await database();
  state.invoiceAuth ??= new Map();
  if (!state.invoiceAuth.has(key)) {
    const opening = createAuth(url.origin);
    state.invoiceAuth.set(key, opening);
    opening.catch(() => state.invoiceAuth?.delete(key));
  }
  return state.invoiceAuth.get(key)!;
}
