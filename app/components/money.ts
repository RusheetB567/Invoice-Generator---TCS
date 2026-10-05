export function money(cents: string | bigint, currency: string) {
  const value = BigInt(cents);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).formatToParts(value / BigInt(100)).map(part => part.type === "fraction" ? fraction : part.value).join("");
}

export function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
