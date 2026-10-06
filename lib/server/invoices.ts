import { z } from "zod";
import { database } from "./database";
import { VaultError } from "./errors";
import { audit } from "./audit";
import { hundredths, lineTotal, taxTotal } from "../domain/invoice-math";
import type { Draft, BrandSettings, ReminderSettings } from "../local-data";
import type { BusinessWorkspace } from "../domain/business";
import { validateFile } from "./extraction";
import { scanFile } from "./scanner";

const field = z.string().max(10000);
const logo = z.string().max(3000000).refine(value => !value || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value));
const money = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const formSchema = z.object({ company: field, tagline: field, companyAddress: field, customer: field, customerAddress: field, location: field, number: z.string().max(80), issued: field, due: field, brand: z.string().regex(/^#[0-9a-f]{6}$/i), lineLabel: field, taxLabel: field, tax: money, notes: field, payment: field, businessIdentifier: field }).strict();
const draftSchema = z.object({
  id: z.string().uuid(), revision: z.number().int().nonnegative().optional(), number: z.string().max(80), company: field, customer: field,
  currency: z.enum(["AUD", "USD", "GBP", "EUR"]), status: z.enum(["Draft", "Sent", "Paid", "Cancelled"]),
  issued: z.string(), due: z.string(), updatedAt: z.string(), subtotalCents: z.string().regex(/^\d{1,22}$/), taxCents: z.string().regex(/^\d{1,22}$/), totalCents: z.string().regex(/^\d{1,22}$/),
  form: formSchema, logo, format: z.enum(["sections", "table"]).optional(),
  sections: z.array(z.object({ id: z.number().int().positive(), heading: z.string().trim().min(1).max(300), details: field, amount: money }).strict()).min(1).max(50).optional(),
  items: z.array(z.object({ id: z.number().int().positive(), description: z.string().trim().min(1).max(300), details: field, quantity: money, rate: money }).strict()).max(50),
}).strict();
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateInvoice(raw: unknown): Draft {
  const checked = draftSchema.safeParse(raw);
  if (!checked.success) throw new VaultError("Check the invoice details, billing amounts and logo before saving.", 422);
  const draft = checked.data;
  if (draft.logo) validateFile(Buffer.from(draft.logo.split(",")[1], "base64"), draft.logo.startsWith("data:image/png") ? "logo.png" : "logo.jpg", draft.logo.startsWith("data:image/png") ? "image/png" : "image/jpeg");
  if (!draft.company.trim() || !draft.customer.trim() || !draft.form.taxLabel.trim() || draft.company !== draft.form.company || draft.customer !== draft.form.customer || draft.number !== draft.form.number || draft.issued !== draft.form.issued || draft.due !== draft.form.due || !validDate(draft.issued) || !validDate(draft.due) || draft.due < draft.issued) throw new VaultError("Invoice details or dates are invalid.", 422);
  const sections = draft.format === "sections", charges = sections ? draft.sections : draft.items;
  if (sections && draft.items.length) throw new VaultError("A flexible invoice must contain only its visible billing sections.", 422);
  if (!charges?.length || new Set(charges.map(row => row.id)).size !== charges.length) throw new VaultError("Add distinct billing entries.", 422);
  let subtotal = BigInt(0);
  if (sections) for (const section of draft.sections!) {
    const value = hundredths(section.amount, BigInt(9999999)); if (value === null) throw new VaultError("A billing amount exceeds the supported limit.", 422); subtotal += value;
  } else for (const row of draft.items) {
    const quantity = hundredths(row.quantity, BigInt(99999)), rate = hundredths(row.rate, BigInt(9999999));
    if (quantity === null || rate === null) throw new VaultError("A billing quantity or rate exceeds the supported limit.", 422); subtotal += lineTotal(quantity, rate);
  }
  const taxRate = hundredths(draft.form.tax, BigInt(100));
  if (taxRate === null) throw new VaultError("Tax must be between 0 and 100 percent.", 422);
  const tax = taxTotal(subtotal, taxRate);
  if (draft.subtotalCents !== subtotal.toString() || draft.taxCents !== tax.toString() || draft.totalCents !== (subtotal + tax).toString()) throw new VaultError("Invoice totals do not match the billing entries. Recalculate before saving.", 422);
  return draft;
}
export async function listInvoices(workspaceId: string) {
  return (await (await database()).query<{ payload: Draft }>("SELECT payload FROM created_invoice WHERE workspace_id=$1 AND archived=FALSE ORDER BY updated_at DESC LIMIT 1000", [workspaceId])).rows.map(row => row.payload);
}
export async function invoiceSummary(workspaceId: string) {
  return (await (await database()).query<{ currency: string; status: Draft["status"]; count: number; totalCents: string }>(`SELECT payload->>'currency' AS currency,payload->>'status' AS status,COUNT(*)::int AS count,SUM((payload->>'totalCents')::numeric)::text AS "totalCents" FROM created_invoice WHERE workspace_id=$1 AND archived=FALSE GROUP BY payload->>'currency',payload->>'status'`, [workspaceId])).rows;
}
export async function getInvoice(workspaceId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new VaultError("Invoice not found.", 404);
  const row = (await (await database()).query<{ payload: Draft; archived: boolean }>("SELECT payload,archived FROM created_invoice WHERE workspace_id=$1 AND id=$2", [workspaceId, id])).rows[0];
  if (!row) throw new VaultError("Invoice not found.", 404);
  return row;
}
export async function saveInvoice(workspaceId: string, actorId: string, raw: unknown) {
  const draft = validateInvoice(raw);
  if (draft.logo) await scanFile(Buffer.from(draft.logo.split(",")[1], "base64"));
  return (await database()).transaction(async tx => {
    await tx.query("SELECT id FROM business_workspace WHERE id=$1 FOR UPDATE", [workspaceId]);
    const old = (await tx.query<{ revision: number }>("SELECT revision FROM created_invoice WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [workspaceId, draft.id])).rows[0];
    if ((old?.revision ?? 0) !== (draft.revision ?? 0)) throw new VaultError("This invoice changed in another session. Reload it before saving your changes.", 409);
    // A UUID owned by another workspace must not become an update target.
    if (!old && (await tx.query("SELECT id FROM created_invoice WHERE id=$1", [draft.id])).rows.length) throw new VaultError("Invoice not found.", 404);
    let number = draft.number.trim();
    if (!number) {
      await tx.query("INSERT INTO invoice_sequence(workspace_id) VALUES($1) ON CONFLICT DO NOTHING", [workspaceId]);
      do {
        const next = (await tx.query<{ value: string }>("UPDATE invoice_sequence SET next_number=next_number+1 WHERE workspace_id=$1 RETURNING (next_number-1)::text AS value", [workspaceId])).rows[0].value;
        number = `INV-${next.padStart(5, "0")}`;
      } while ((await tx.query("SELECT id FROM created_invoice WHERE workspace_id=$1 AND number=$2", [workspaceId, number.toUpperCase()])).rows.length);
    }
    if ((await tx.query("SELECT id FROM created_invoice WHERE workspace_id=$1 AND number=$2 AND id<>$3", [workspaceId, number.toUpperCase(), draft.id])).rows.length) throw new VaultError("That invoice number is already used in this workspace.", 409);
    const revision = (old?.revision ?? 0) + 1;
    const saved: Draft = { ...draft, number, form: { ...draft.form, number }, revision, updatedAt: new Date().toISOString() };
    await tx.query("INSERT INTO created_invoice(id,workspace_id,number,payload,revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET number=$3,payload=$4,revision=$5,archived=FALSE,updated_at=now() WHERE created_invoice.workspace_id=$2", [saved.id, workspaceId, number.toUpperCase(), JSON.stringify(saved), revision]);
    await tx.query("INSERT INTO invoice_revision(invoice_id,revision,payload,actor_id) VALUES($1,$2,$3,$4)", [saved.id, revision, JSON.stringify(saved), actorId]);
    await audit(tx, workspaceId, actorId, old ? "invoice.update" : "invoice.create", saved.id, { revision });
    return saved;
  });
}
export async function archiveInvoice(workspaceId: string, actorId: string, id: string, revision: number) {
  await getInvoice(workspaceId, id);
  return (await database()).transaction(async tx => {
    const old = (await tx.query<{ payload: Draft }>("SELECT payload FROM created_invoice WHERE workspace_id=$1 AND id=$2 AND revision=$3 AND archived=FALSE FOR UPDATE", [workspaceId, id, revision])).rows[0];
    if (!old) throw new VaultError("This invoice changed. Reload before archiving.", 409);
    const saved = { ...old.payload, revision: revision + 1, updatedAt: new Date().toISOString() };
    await tx.query("UPDATE created_invoice SET archived=TRUE,revision=$3,payload=$4,updated_at=now() WHERE workspace_id=$1 AND id=$2", [workspaceId, id, saved.revision, JSON.stringify(saved)]);
    await tx.query("INSERT INTO invoice_revision(invoice_id,revision,payload,actor_id) VALUES($1,$2,$3,$4)", [id, saved.revision, JSON.stringify({ ...saved, archived: true }), actorId]);
    await audit(tx, workspaceId, actorId, "invoice.archive", id, { revision: saved.revision });
    return saved;
  });
}
export const brandSchema = z.object({ company: field, tagline: field, companyAddress: field, businessIdentifier: field, brand: z.string().regex(/^#[0-9a-f]{6}$/i), payment: field, logo }).strict();
export const remindersSchema = z.object({ enabled: z.boolean(), days: z.array(z.number().int().min(0).max(365)).max(20).refine(value => new Set(value).size === value.length), includeSummary: z.boolean(), includePdf: z.boolean(), minimumAmount: money }).strict();
export async function workspaceState(workspace: BusinessWorkspace) {
  const [drafts, result] = await Promise.all([listInvoices(workspace.id), (await database()).query<{ brand: BrandSettings | null; reminders: ReminderSettings | null; revision: number }>("SELECT brand,reminders,revision FROM workspace_preferences WHERE workspace_id=$1", [workspace.id])]);
  const profile = workspace.profile;
  return { drafts, summary: await invoiceSummary(workspace.id), brand: result.rows[0]?.brand ?? { company: profile.legalName || workspace.name, tagline: "", companyAddress: profile.address || "", businessIdentifier: profile.businessNumber || "", brand: profile.accent || "#7240c4", payment: profile.payment || "", logo: "" }, reminders: result.rows[0]?.reminders ?? null, preferencesRevision: result.rows[0]?.revision ?? 0 };
}
export async function savePreferences(workspaceId: string, actorId: string, raw: unknown) {
  const input = z.object({ revision: z.number().int().nonnegative(), brand: brandSchema.optional(), reminders: remindersSchema.optional() }).strict().safeParse(raw);
  if (!input.success || (!input.data.brand && !input.data.reminders)) throw new VaultError("Check your business preferences before saving.", 422);
  if (input.data.brand?.logo) {
    const value = input.data.brand.logo, bytes = Buffer.from(value.split(",")[1], "base64"), png = value.startsWith("data:image/png");
    validateFile(bytes, png ? "logo.png" : "logo.jpg", png ? "image/png" : "image/jpeg"); await scanFile(bytes);
  }
  return (await database()).transaction(async tx => {
    await tx.query("SELECT id FROM business_workspace WHERE id=$1 FOR UPDATE", [workspaceId]);
    await tx.query("INSERT INTO workspace_preferences(workspace_id) VALUES($1) ON CONFLICT DO NOTHING", [workspaceId]);
    const old = (await tx.query<{ revision: number }>("SELECT revision FROM workspace_preferences WHERE workspace_id=$1 FOR UPDATE", [workspaceId])).rows[0];
    if (old.revision !== input.data.revision) throw new VaultError("These preferences changed in another session. Reload before saving.", 409);
    const result = await tx.query<{ brand: BrandSettings; reminders: ReminderSettings; revision: number }>("UPDATE workspace_preferences SET brand=COALESCE($2::jsonb,brand),reminders=COALESCE($3::jsonb,reminders),revision=revision+1,updated_at=now() WHERE workspace_id=$1 RETURNING brand,reminders,revision", [workspaceId, input.data.brand ? JSON.stringify(input.data.brand) : null, input.data.reminders ? JSON.stringify(input.data.reminders) : null]);
    await audit(tx, workspaceId, actorId, "preferences.update", undefined, { branding: Boolean(input.data.brand), reminders: Boolean(input.data.reminders), revision: old.revision + 1 });
    return result.rows[0];
  });
}
