import type { TaxRules } from "../../types";
import { brackets, lito, medicare, sources } from "./shared";
export const rules2025: TaxRules = {
  financialYear: "2025-26", version: "AU-resident-single-2025-26.v1", effectiveFrom: "2025-07-01", effectiveTo: "2026-06-30", verifiedAt: "2026-10-05",
  note: "Includes the Medicare low-income threshold amendment applying to 2025–26 assessments.",
  brackets: brackets(1600), lito, medicare, sources,
};
