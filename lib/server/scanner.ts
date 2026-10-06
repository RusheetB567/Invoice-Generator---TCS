import { createConnection } from "node:net";
import { production } from "./config";
import { VaultError } from "./errors";
export function scanFile(bytes: Buffer): Promise<"clean" | "local-validated"> {
  const socketPath = process.env.INVOICEFLOW_CLAMAV_SOCKET;
  if (!socketPath) {
    if (production()) throw new VaultError("The file scanner is unavailable. Uploads are paused.", 503);
    return Promise.resolve("local-validated");
  }
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    let reply = "", settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; socket.destroy();
      if (error) reject(error); else resolve("clean");
    };
    socket.setTimeout(30000, () => finish(new VaultError("The file scanner timed out. Uploads are paused.", 503)));
    socket.once("error", () => finish(new VaultError("The file scanner is unavailable. Uploads are paused.", 503)));
    socket.once("connect", async () => {
      try {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const chunk = bytes.subarray(offset, offset + 65536), size = Buffer.alloc(4); size.writeUInt32BE(chunk.length);
          socket.write(size);
          if (!socket.write(chunk)) await new Promise<void>((done, fail) => {
            const drained = () => { socket.off("error", failed); done(); };
            const failed = (error: Error) => { socket.off("drain", drained); fail(error); };
            socket.once("drain", drained); socket.once("error", failed);
          });
        }
        socket.write(Buffer.alloc(4));
      } catch { finish(new VaultError("The file scanner could not complete this upload.", 503)); }
    });
    socket.on("data", data => {
      reply += data.toString("utf8");
      if (reply.length > 4096) return finish(new VaultError("Unexpected file scanner response.", 503));
      if (reply.includes("\0") || reply.includes("\n")) {
        if (/^stream: OK[\0\r\n]*$/.test(reply)) finish();
        else finish(new VaultError(reply.includes("FOUND") ? "This file was blocked by malware scanning." : "The file scanner could not approve this file.", reply.includes("FOUND") ? 422 : 503));
      }
    });
    socket.once("close", () => { if (!settled) finish(new VaultError("The file scanner connection ended before approval.", 503)); });
  });
}
