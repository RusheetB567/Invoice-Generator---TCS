"use client";

import { useMemo, useSyncExternalStore } from "react";

export type Draft = {
  id: string; number: string; customer: string; company: string; currency: string;
  subtotalCents: string; taxCents: string; totalCents: string; issued: string; due: string;
  status: "Draft" | "Sent" | "Paid" | "Cancelled"; updatedAt: string;
  form: Record<string, string>;
  items: Array<{ id: number; description: string; details: string; quantity: string; rate: string }>;
  // Missing format means the original structured table, preserving older invoices.
  format?: "sections" | "table";
  sections?: Array<{ id: number; heading: string; details: string; amount: string }>;
  logo: string;
};
export type BrandSettings = {
  company: string; tagline: string; companyAddress: string; businessIdentifier: string;
  brand: string; payment: string; logo: string;
};
export type ReminderSettings = {
  enabled: boolean; days: number[]; includeSummary: boolean; includePdf: boolean; minimumAmount: string;
};
export const DRAFTS_KEY = "tcs-invoiceflow-drafts";
export const BRAND_KEY = "tcs-invoiceflow-brand";
export const REMINDERS_KEY = "tcs-invoiceflow-reminders";
export const CHANGE_EVENT = "tcs-invoiceflow-change";
let workspaceScope: string | null = null;
export function setWorkspaceScope(scope: string | null) { workspaceScope = scope; }
const scopedKey = (key: string) => workspaceScope ? `${key}:${workspaceScope}` : null;

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 10000): value is string => typeof value === "string" && value.length <= max;
const logoValue = (value: unknown): value is string => text(value, 3000000) && (value === "" || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value));
const cents = (value: unknown): value is string => typeof value === "string" && /^\d{1,22}$/.test(value);

function isDraft(value: unknown): value is Draft {
  if (!record(value) || !record(value.form) || !Array.isArray(value.items)) return false;
  const sectionBody = value.format === "sections";
  if (value.format !== undefined && value.format !== "sections" && value.format !== "table") return false;
  if (sectionBody && (!Array.isArray(value.sections) || value.sections.length < 1)) return false;
  if (value.sections !== undefined && (!Array.isArray(value.sections) || value.sections.length > 50
    || !value.sections.every(section => record(section) && Number.isSafeInteger(section.id) && Number(section.id) > 0
      && text(section.heading, 300) && text(section.details) && text(section.amount, 32))
    || new Set(value.sections.map(section => section.id)).size !== value.sections.length)) return false;
  const strings = ["id", "number", "customer", "company", "issued", "due", "updatedAt"];
  return strings.every(key => text(value[key], 300)) && typeof value.id === "string" && value.id.length > 0
    && ["AUD", "USD", "GBP", "EUR"].includes(String(value.currency))
    && ["Draft", "Sent", "Paid", "Cancelled"].includes(String(value.status))
    && [value.subtotalCents, value.taxCents, value.totalCents].every(cents)
    && Object.keys(value.form).length <= 40 && Object.values(value.form).every(field => text(field))
    && (sectionBody || value.items.length > 0) && value.items.length <= 50
    && value.items.every(item => record(item) && Number.isSafeInteger(item.id) && Number(item.id) > 0
      && text(item.description, 300) && text(item.details) && text(item.quantity, 32) && text(item.rate, 32))
    && new Set(value.items.map(item => item.id)).size === value.items.length && logoValue(value.logo);
}
function isBrand(value: unknown): value is BrandSettings {
  if (!record(value)) return false;
  return ["company", "tagline", "companyAddress", "businessIdentifier", "payment"].every(key => text(value[key]))
    && typeof value.brand === "string" && /^#[0-9a-f]{6}$/i.test(value.brand) && logoValue(value.logo);
}
function isReminders(value: unknown): value is ReminderSettings {
  return record(value) && typeof value.enabled === "boolean" && typeof value.includeSummary === "boolean"
    && typeof value.includePdf === "boolean" && Array.isArray(value.days) && value.days.length <= 20
    && value.days.every(day => Number.isInteger(day) && day >= 0 && day <= 365)
    && new Set(value.days).size === value.days.length && typeof value.minimumAmount === "string"
    && /^\d{1,9}(\.\d{1,2})?$/.test(value.minimumAmount);
}
function rawValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  const scoped = scopedKey(key);
  if (!scoped) return null;
  try { return window.localStorage.getItem(scoped); } catch { return null; }
}
function parse(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function parseDrafts(raw: string | null): Draft[] {
  const value = parse(raw);
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((draft): draft is Draft => {
    if (!isDraft(draft) || seen.has(draft.id)) return false;
    seen.add(draft.id);
    return true;
  });
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
function useRaw(key: string) {
  return useSyncExternalStore(subscribe, () => rawValue(key), () => null);
}
export function useDrafts(): Draft[] {
  const raw = useRaw(DRAFTS_KEY);
  return useMemo(() => parseDrafts(raw), [raw]);
}
export function useBrand(): BrandSettings | null {
  const raw = useRaw(BRAND_KEY);
  return useMemo(() => { const value = parse(raw); return isBrand(value) ? value : null; }, [raw]);
}
export function useReminders(): ReminderSettings | null {
  const raw = useRaw(REMINDERS_KEY);
  return useMemo(() => { const value = parse(raw); return isReminders(value) ? value : null; }, [raw]);
}
export function readBrand(): BrandSettings | null {
  const value = parse(rawValue(BRAND_KEY));
  return isBrand(value) ? value : null;
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") throw new Error("Local saving is available in your browser only.");
  const scoped = scopedKey(key);
  if (!scoped) throw new Error("Open your business workspace before saving.");
  try { window.localStorage.setItem(scoped, JSON.stringify(value)); }
  catch (error) {
    const quota = error instanceof DOMException && ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name);
    throw new Error(quota ? "Your browser storage is full. Remove unused drafts or use a smaller logo, then try again." : "This browser cannot save local data. Check its storage or privacy settings and try again.");
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}
export function saveDraft(draft: Draft) {
  if (!isDraft(draft)) throw new Error("This draft contains invalid data. Check the invoice fields before saving.");
  const current = parseDrafts(rawValue(DRAFTS_KEY));
  write(DRAFTS_KEY, [draft, ...current.filter(item => item.id !== draft.id)]);
}
export function deleteDraft(id: string) {
  write(DRAFTS_KEY, parseDrafts(rawValue(DRAFTS_KEY)).filter(draft => draft.id !== id));
}
export function saveBrand(settings: BrandSettings) {
  if (!isBrand(settings)) throw new Error("Check your brand settings and use a valid colour and PNG or JPG logo.");
  write(BRAND_KEY, settings);
}
export function saveReminders(settings: ReminderSettings) {
  if (!isReminders(settings)) throw new Error("Check your reminder days and minimum amount before saving.");
  write(REMINDERS_KEY, settings);
}
