import { randomUUID } from "node:crypto";
import { database, VaultError } from "./vault";
import type { ContactInput } from "../domain/contact";
export async function listContacts(workspaceId: string) {
  const result = await (
    await database()
  ).query<{ id: string; payload: ContactInput; archived: boolean }>(
    "SELECT id,payload,archived FROM workspace_contact WHERE workspace_id=$1 ORDER BY created_at DESC",
    [workspaceId],
  );
  return result.rows.map((row) => ({
    ...row.payload,
    id: row.id,
    archived: row.archived,
  }));
}
export async function saveContact(
  workspaceId: string,
  value: ContactInput,
  id?: string,
) {
  const db = await database();
  if (id) {
    const result = await db.query(
      "UPDATE workspace_contact SET payload=$3 WHERE id=$1 AND workspace_id=$2 RETURNING id",
      [id, workspaceId, JSON.stringify(value)],
    );
    if (!result.rows.length) throw new VaultError("Contact not found.", 404);
    return id;
  }
  const next = randomUUID();
  await db.query(
    "INSERT INTO workspace_contact(id,workspace_id,payload) VALUES($1,$2,$3)",
    [next, workspaceId, JSON.stringify(value)],
  );
  return next;
}
export async function archiveContact(
  workspaceId: string,
  id: string,
  archived = true,
) {
  const result = await (
    await database()
  ).query(
    "UPDATE workspace_contact SET archived=$3 WHERE id=$1 AND workspace_id=$2 RETURNING id",
    [id, workspaceId, archived],
  );
  if (!result.rows.length) throw new VaultError("Contact not found.", 404);
}
