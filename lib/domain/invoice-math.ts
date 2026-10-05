/** Decimal input is converted to integers before calculations; never use float money. */
export function hundredths(value: string, maximum: bigint): bigint | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const parsed = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return parsed <= maximum * BigInt(100) ? parsed : null;
}

/** Quantity and rate have two decimal places; each extended charge rounds half up. */
export function lineTotal(quantity: bigint, rateCents: bigint): bigint {
  if (quantity < BigInt(0) || rateCents < BigInt(0)) throw new RangeError("Charges cannot be negative.");
  return (quantity * rateCents + BigInt(50)) / BigInt(100);
}

/** Tax is an exclusive invoice-wide percentage in basis points, rounded once. */
export function taxTotal(subtotalCents: bigint, taxBasisPoints: bigint): bigint {
  if (subtotalCents < BigInt(0) || taxBasisPoints < BigInt(0) || taxBasisPoints > BigInt(10000)) {
    throw new RangeError("Invalid subtotal or tax percentage.");
  }
  return (subtotalCents * taxBasisPoints + BigInt(5000)) / BigInt(10000);
}

export function outstandingBalance(totalCents: bigint, payments: readonly bigint[]): bigint {
  if (totalCents < BigInt(0) || payments.some(payment => payment < BigInt(0))) throw new RangeError("Amounts cannot be negative.");
  const paid = payments.reduce((sum, payment) => sum + payment, BigInt(0));
  if (paid > totalCents) throw new RangeError("Payments exceed the invoice total.");
  return totalCents - paid;
}
