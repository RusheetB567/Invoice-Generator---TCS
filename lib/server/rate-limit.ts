import { database } from "./database";
import { VaultError } from "./errors";
export async function limitWorkspace(userId: string, workspaceId: string, request: Request) {
  const route = new URL(request.url).pathname;
  const category = route.endsWith("/pdf") ? "pdf" : route.includes("/vault") && request.method !== "GET" ? "intake" : request.method === "GET" ? "read" : "write";
  const maximum = category === "pdf" ? 10 : category === "intake" ? 20 : 100;
  const key = `${userId}:${workspaceId}:${category}`;
  const result = await (await database()).query<{ count: number }>(`INSERT INTO workspace_rate_limit(key,count,started_at) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN workspace_rate_limit.started_at<now()-INTERVAL '1 minute' THEN 1 ELSE workspace_rate_limit.count+1 END, started_at=CASE WHEN workspace_rate_limit.started_at<now()-INTERVAL '1 minute' THEN now() ELSE workspace_rate_limit.started_at END RETURNING count`, [key]);
  if (result.rows[0].count > maximum) throw new VaultError("Too many workspace requests. Wait a minute before trying again.", 429);
}
