import { z } from "zod";
export const contactSchema = z.object({
  kind: z.enum(["Client", "Supplier"]),
  name: z.string().trim().min(1).max(200),
  email: z.union([z.literal(""), z.email()]),
  businessNumber: z.string().trim().max(80),
  address: z.string().trim().max(1000),
  notes: z.string().max(3000),
});
export type ContactInput = z.infer<typeof contactSchema>;
export type Contact = ContactInput & { id: string; archived: boolean };
