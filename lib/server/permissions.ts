import { VaultError } from "./errors";
import type { BusinessWorkspace } from "../domain/business";
export type Permission = "invoice.read" | "invoice.write" | "invoice.archive" | "business.manage" | "records.export" | "workspace.export" | "contacts.write";
const read: Permission[] = ["invoice.read"];
const member: Permission[] = [...read, "invoice.write", "contacts.write"];
const admin: Permission[] = [...member, "invoice.archive", "business.manage", "records.export", "workspace.export"];
const roles: Record<string, readonly Permission[]> = { OWNER: admin, ADMIN: admin, MEMBER: member, VIEWER: read };
export function permitted(role: string, permission: Permission) { return roles[role]?.includes(permission) ?? false; }
export function requirePermission(workspace: BusinessWorkspace, permission: Permission) {
  if (!permitted(workspace.role, permission)) throw new VaultError("Your role does not permit this operation.", 403, "PERMISSION_DENIED");
}
