import { randomUUID } from "node:crypto";
import type { SqlConnection } from "./database";
export async function audit(tx: SqlConnection, workspaceId: string, actorId: string, action: string, entityId?: string, metadata: Record<string, number | boolean | string> = {}) {
  await tx.query("INSERT INTO workspace_audit(id,workspace_id,actor_id,action,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), workspaceId, actorId, action, entityId ?? null, JSON.stringify(metadata)]);
}
