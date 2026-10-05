import { z } from "zod";
export const businessNameSchema = z.object({
  name: z.string().trim().min(2).max(160),
});
export const businessProfileSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  address: z.string().trim().max(1000),
  country: z.enum([
    "Australia",
    "New Zealand",
    "United Kingdom",
    "United States",
    "Other",
  ]),
  businessNumber: z.string().trim().max(80),
  currency: z.enum(["AUD", "USD", "GBP", "EUR"]),
  industry: z.string().trim().min(1).max(100),
  gstRegistered: z.boolean(),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  payment: z.string().max(3000),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;
export type BusinessWorkspace = {
  id: string;
  name: string;
  profile: Partial<BusinessProfile>;
  onboarding_complete: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};
