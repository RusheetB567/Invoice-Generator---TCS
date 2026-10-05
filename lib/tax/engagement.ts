/** Only usage metadata is persisted. Income inputs and results stay in memory. */
export const INSIGHT_THRESHOLD = 3;
export const INSIGHT_COUNT = 5;
export interface Engagement { version: 1; entries: number; nextInsight: number }
export interface Visit { engagement: Engagement; insight: number | null }
const empty = (): Engagement => ({ version: 1, entries: 0, nextInsight: 0 });
export function engagementKey(userId: string, workspaceId: string): string {
  return `invoiceflow:tax-engagement:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}`;
}
export function readEngagement(raw: string | null): Engagement {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return empty();
    const candidate = value as Partial<Engagement>;
    if (candidate.version !== 1 || !Number.isInteger(candidate.entries) || candidate.entries! < 0 || candidate.entries! > 10000 || !Number.isInteger(candidate.nextInsight) || candidate.nextInsight! < 0 || candidate.nextInsight! >= INSIGHT_COUNT) return empty();
    // Whitelist only metadata even if a corrupt record contains extra properties.
    return { version: 1, entries: candidate.entries!, nextInsight: candidate.nextInsight! };
  } catch { return empty(); }
}
export function startVisit(engagement: Engagement): Visit {
  if (engagement.entries < INSIGHT_THRESHOLD) return { engagement, insight: null };
  return { engagement: { ...engagement, nextInsight: (engagement.nextInsight + 1) % INSIGHT_COUNT }, insight: engagement.nextInsight };
}
export function completeEntry(visit: Visit): Visit {
  const engagement = { ...visit.engagement, entries: Math.min(10000, visit.engagement.entries + 1) };
  if (visit.insight === null && engagement.entries >= INSIGHT_THRESHOLD) return startVisit(engagement);
  return { engagement, insight: visit.insight };
}
