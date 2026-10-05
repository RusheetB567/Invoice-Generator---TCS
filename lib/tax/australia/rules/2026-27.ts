import type { TaxRules } from "../../types";
import { brackets, lito, medicare, sources } from "./shared";
export const rules2026: TaxRules = {
  financialYear: "2026-27", version: "AU-resident-single-2026-27.current-law.v1", effectiveFrom: "2026-07-01", effectiveTo: "2027-06-30", verifiedAt: "2026-10-05",
  note: "Current-law estimate: Medicare thresholds use enacted law verified 5 October 2026 and may change before year-end. No work-expense or standard deduction is automatically claimed.",
  brackets: brackets(1500), lito, medicare, sources,
};
