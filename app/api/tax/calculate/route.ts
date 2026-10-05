import { calculateTax } from "../../../../lib/tax/calculate";
import { taxInputSchema } from "../../../../lib/tax/schemas";
import { requireWorkspace, sameOriginWrite } from "../../../../lib/server/workspaces";
import { boundedJson } from "../../../../lib/server/request-body";
import { safeError, VaultError } from "../../../../lib/server/vault";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOriginWrite(request);
    await requireWorkspace(request);
    const body = await boundedJson(request, 4096);
    const parsed = taxInputSchema.safeParse(body);
    if (!parsed.success) throw new VaultError("Check your income, supported financial year and work pattern.", 422);
    let result;
    try { result = calculateTax(parsed.data); }
    catch { throw new VaultError("Annualised income must be $10,000,000 or less.", 422); }
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeError(error); }
}
