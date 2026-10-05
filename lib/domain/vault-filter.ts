import { financialYear, type VaultDocument } from "./tax-record";
export type VaultFilters = { year: string; query: string; kind: string; category: string };
export function filterRecords(documents: VaultDocument[], filters: VaultFilters) {
  const query = filters.query.toLowerCase().trim();
  return documents.filter(document => document.record && document.status === "Confirmed"
    && (!filters.year || financialYear(document.record.issued) === filters.year)
    && (!filters.kind || document.record.kind === filters.kind)
    && (!filters.category || document.record.category === filters.category)
    && (!query || `${document.record.supplier} ${document.record.number} ${document.name}`.toLowerCase().includes(query)));
}
