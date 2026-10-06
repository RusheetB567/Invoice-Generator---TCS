export const backendMigration = `
CREATE TABLE IF NOT EXISTS auth_rate_limit (id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_rate_limit (key TEXT PRIMARY KEY, count INTEGER NOT NULL, started_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_preferences (workspace_id UUID PRIMARY KEY REFERENCES business_workspace(id), brand JSONB, reminders JSONB, revision INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS invoice_sequence (workspace_id UUID PRIMARY KEY REFERENCES business_workspace(id), next_number BIGINT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS created_invoice (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), number TEXT NOT NULL, payload JSONB NOT NULL, revision INTEGER NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,number));
CREATE INDEX IF NOT EXISTS created_invoice_scope_idx ON created_invoice(workspace_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS invoice_revision (invoice_id UUID NOT NULL REFERENCES created_invoice(id), revision INTEGER NOT NULL, payload JSONB NOT NULL, actor_id TEXT NOT NULL REFERENCES auth_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(invoice_id,revision));
CREATE TABLE IF NOT EXISTS workspace_audit (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT, metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS workspace_audit_scope_idx ON workspace_audit(workspace_id,created_at DESC);
CREATE OR REPLACE FUNCTION prevent_evidence_changes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence history is append-only'; END $$;
DROP TRIGGER IF EXISTS audit_append_only ON workspace_audit;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON workspace_audit FOR EACH ROW EXECUTE FUNCTION prevent_evidence_changes();
DROP TRIGGER IF EXISTS revision_append_only ON invoice_revision;
CREATE TRIGGER revision_append_only BEFORE UPDATE OR DELETE ON invoice_revision FOR EACH ROW EXECUTE FUNCTION prevent_evidence_changes();
CREATE OR REPLACE FUNCTION record_session_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_id TEXT; BEGIN
  account_id := CASE WHEN TG_OP='INSERT' THEN NEW.user_id ELSE OLD.user_id END;
  INSERT INTO workspace_audit(id,workspace_id,actor_id,action,metadata)
    SELECT gen_random_uuid(),workspace_id,account_id,CASE WHEN TG_OP='INSERT' THEN 'auth.session.created' ELSE 'auth.session.ended' END,'{}'::jsonb FROM workspace_membership WHERE user_id=account_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS session_audit ON auth_session;
CREATE TRIGGER session_audit AFTER INSERT OR DELETE ON auth_session FOR EACH ROW EXECUTE FUNCTION record_session_event();
CREATE TABLE IF NOT EXISTS stored_object (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), object_key TEXT NOT NULL UNIQUE, version_id TEXT, sha256 TEXT NOT NULL, size BIGINT NOT NULL, scan_status TEXT NOT NULL CHECK(scan_status IN ('local-validated','clean','blocked')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS privacy_request (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), actor_id TEXT NOT NULL REFERENCES auth_user(id), kind TEXT NOT NULL CHECK(kind IN ('access','correction','deletion')), status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS generated_pdf (id UUID PRIMARY KEY REFERENCES stored_object(id), workspace_id UUID NOT NULL REFERENCES business_workspace(id), invoice_id UUID NOT NULL REFERENCES created_invoice(id), revision INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(invoice_id,revision));
CREATE TABLE IF NOT EXISTS vault_spreadsheet_import (id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES business_workspace(id), hash TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,hash));
`;
