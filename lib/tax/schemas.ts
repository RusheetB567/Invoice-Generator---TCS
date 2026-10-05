import { z } from "zod";
import { hundredths } from "../domain/invoice-math";
import { periods } from "./types";
export const taxInputSchema = z.object({
  income: z.string().max(15).refine(value => hundredths(value, BigInt(10000000)) !== null, "Enter an amount from $0 to $10,000,000 with up to two decimal places."),
  frequency: z.enum(periods),
  financialYear: z.enum(["2025-26", "2026-27"]),
  employment: z.literal("employee"),
  residency: z.literal("resident"),
  hoursPerWeek: z.number().finite().min(1).max(100).multipleOf(0.5),
  weeksPerYear: z.number().finite().min(1).max(52).int(),
  daysPerWeek: z.number().finite().min(1).max(7).int(),
}).strict();
