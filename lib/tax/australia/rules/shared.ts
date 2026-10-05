import type { TaxRules } from "../../types";
export const sources = [
  { title: "Resident rates · Income Tax Rates Act, Schedule 7", url: "https://www.legislation.gov.au/C2004A03348/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html" },
  { title: "Medicare Levy Act, sections 3, 6 and 7", url: "https://www.legislation.gov.au/C2004A03351/2026-07-01/2026-07-01/text/original/epub/OEBPS/document_1/document_1.html" },
  { title: "2025–26 Medicare amendment · Schedule 5", url: "https://www.legislation.gov.au/C2026A00058/asmade/2026-06-30/text/original/pdf" },
  { title: "Low income offset · Assessment Act, sections 61-110/115", url: "https://www.legislation.gov.au/C2004A05138/2026-08-27/2026-08-27/text/original/epub/OEBPS/document_2/document_2.html" },
] as const;
export const medicare: TaxRules["medicare"] = { threshold: 28011, phaseInLimit: 35013, rate: 200, phaseInRate: 1000 };
export const lito: TaxRules["lito"] = { maximum: 700, firstThreshold: 37500, secondThreshold: 45000, finalThreshold: 66667, secondMaximum: 325, firstTaper: 500, secondTaper: 150 };
export function brackets(firstRate: number): TaxRules["brackets"] {
  return [{ lower: 0, upper: 18200, basisPoints: 0 }, { lower: 18200, upper: 45000, basisPoints: firstRate }, { lower: 45000, upper: 135000, basisPoints: 3000 }, { lower: 135000, upper: 190000, basisPoints: 3700 }, { lower: 190000, upper: null, basisPoints: 4500 }];
}
