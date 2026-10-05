"use client";
export async function downloadWorkbook(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "The workbook could not be downloaded."); }
  if (!response.headers.get("content-type")?.includes("spreadsheetml")) throw new Error("The workbook could not be downloaded. Sign in again and retry.");
  const objectUrl = URL.createObjectURL(await response.blob()), link = document.createElement("a");
  link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
