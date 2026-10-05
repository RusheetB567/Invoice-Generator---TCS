// Additive local PostgreSQL migration. Legacy documents deliberately remain unassigned.
export const accountMigration = `
CREATE TABLE IF NOT EXISTS auth_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified BOOLEAN NOT NULL, image TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS auth_session (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, ip_address TEXT, user_agent TEXT);
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id);
CREATE TABLE IF NOT EXISTS auth_account (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at TIMESTAMPTZ, refresh_token_expires_at TIMESTAMPTZ, scope TEXT, password TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, UNIQUE(provider_id,account_id));
CREATE TABLE IF NOT EXISTS auth_verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS business_workspace (id UUID PRIMARY KEY, name TEXT NOT NULL, profile JSONB NOT NULL DEFAULT '{}', onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workspace_membership (workspace_id UUID NOT NULL REFERENCES business_workspace(id), user_id TEXT NOT NULL REFERENCES auth_user(id), role TEXT NOT NULL CHECK(role IN ('OWNER','ADMIN','MEMBER','VIEWER')), PRIMARY KEY(workspace_id,user_id), UNIQUE(user_id));
ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES business_workspace(id);
ALTER TABLE vault_documents DROP CONSTRAINT IF EXISTS vault_documents_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS vault_workspace_hash_idx ON vault_documents(workspace_id,hash);
CREATE INDEX IF NOT EXISTS vault_workspace_created_idx ON vault_documents(workspace_id,created_at DESC);
CREATE TABLE IF NOT EXISTS workspace_contact (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), payload JSONB NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS workspace_contact_scope_idx ON workspace_contact(workspace_id);
CREATE TABLE IF NOT EXISTS workspace_enquiry (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), question TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
`;
