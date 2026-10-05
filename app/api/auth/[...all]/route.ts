import { getAuth } from "../../../../lib/server/auth";
import { safeError } from "../../../../lib/server/vault";
import { boundedJson } from "../../../../lib/server/request-body";
export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    if (request.method === "POST") {
      const body = await boundedJson(request, 16000);
      if (
        new URL(request.url).pathname.endsWith("/sign-up/email") &&
        typeof body.firstName === "string" &&
        typeof body.lastName === "string"
      )
        body.name = `${body.firstName.trim()} ${body.lastName.trim()}`;
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      request = new Request(request.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }
    return await (await getAuth(new URL(request.url).origin)).handler(request);
  } catch (error) {
    return safeError(error);
  }
}
export const GET = handle;
export const POST = handle;
