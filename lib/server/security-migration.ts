// Reviewed additive migration; authentication secrets are encrypted by Better Auth.
export const securityMigration = `
ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE auth_two_factor (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE,
 secret TEXT NOT NULL, backup_codes TEXT NOT NULL, verified BOOLEAN NOT NULL DEFAULT TRUE,
 failed_verification_count INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ
);
CREATE TABLE auth_assurance (
 session_id TEXT PRIMARY KEY REFERENCES auth_session(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 method TEXT NOT NULL CHECK(method IN ('totp','recovery')), verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE auth_totp_use (
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL, used_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,code_hash)
);
CREATE INDEX auth_totp_expiry ON auth_totp_use(used_at);
`;
