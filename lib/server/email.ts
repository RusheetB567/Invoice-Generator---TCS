import { applicationOrigin } from "./config";
import { VaultError } from "./errors";
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.INVOICEFLOW_EMAIL_FROM);
export async function sendAccountEmail(email: string, url: string, kind: "verify" | "reset") {
  if (!emailConfigured()) throw new VaultError("Account email delivery is not configured.", 503);
  if (new URL(url).origin !== applicationOrigin(new URL(url).origin)) throw new VaultError("Account link is not allowed.", 403);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.INVOICEFLOW_EMAIL_FROM, to: [email], subject: kind === "verify" ? "Verify your InvoiceFlow email" : "Reset your InvoiceFlow password", text: `${kind === "verify" ? "Verify your email" : "Reset your password"} using this private link:\n${url}\n\nIf you did not request this, ignore this email.` }),
  });
  // Provider responses can contain recipient details; never put them in logs or client errors.
  if (!response.ok) { await response.body?.cancel(); throw new VaultError("Account email could not be delivered. Try again later.", 503); }
  await response.body?.cancel();
}
