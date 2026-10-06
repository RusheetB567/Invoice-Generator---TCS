import path from "node:path";
import { VaultError } from "./errors";

export const dataDirectory = () => path.resolve(process.env.INVOICEFLOW_DATA_DIR || path.join(process.cwd(), "storage", "tax-vault"));
export const production = () => process.env.NODE_ENV === "production";
export function applicationOrigin(requestOrigin?: string) {
  const configured = process.env.BETTER_AUTH_URL;
  const url = new URL(configured || requestOrigin || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (production() && (!configured || url.protocol !== "https:" || local)) throw new VaultError("Configure the public HTTPS application origin before enabling hosting.", 503);
  if (!production() && !local) throw new VaultError("Development access is restricted to localhost.", 503);
  if (requestOrigin && new URL(requestOrigin).origin !== url.origin) throw new VaultError("This application origin is not configured.", 403);
  return url.origin;
}
export function requestOrigin(request: Request) {
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured) return applicationOrigin(new URL(request.url).origin);
  const expected = applicationOrigin(), incomingHost = request.headers.get("host");
  // Next may construct its internal Request URL using the listener hostname.
  // Only the configured public Host is accepted; never trust forwarded-host headers.
  if (incomingHost ? incomingHost !== new URL(expected).host : new URL(request.url).origin !== expected) throw new VaultError("This application origin is not configured.", 403);
  return expected;
}
export function assertProductionConfigured() {
  if (!production()) return;
  applicationOrigin();
  const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "INVOICEFLOW_S3_BUCKET", "INVOICEFLOW_S3_REGION", "INVOICEFLOW_CLAMAV_SOCKET", "RESEND_API_KEY", "INVOICEFLOW_EMAIL_FROM", "INVOICEFLOW_LEGAL_OPERATOR", "INVOICEFLOW_PRIVACY_EMAIL"];
  if (required.some(key => !process.env[key]) || (process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32 || process.env.INVOICEFLOW_STORAGE !== "s3" || process.env.INVOICEFLOW_PRODUCTION_APPROVED !== "true") {
    throw new VaultError("Production services and launch checks are not configured. Your local installation remains available in development mode.", 503);
  }
}
export function postgresOptions() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new VaultError("The production database is not configured.", 503);
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new VaultError("Configure a PostgreSQL database URL.", 503);
  // pg connection-string SSL options would otherwise override verified TLS below.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(process.env.INVOICEFLOW_DATABASE_CA ? { ca: process.env.INVOICEFLOW_DATABASE_CA } : {}) }, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 30000 };
}
