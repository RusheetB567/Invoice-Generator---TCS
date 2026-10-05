import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readTheme, themeCookie, themeFromCookies } from "../lib/theme.ts";
const hook = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, {get: (_, key) => String(key)});" };
  return nextLoad(url, context);
} });
const { default: ThemeProvider } = await import("../app/components/theme-provider.tsx");
const { default: ProfileMenu } = await import("../app/components/profile-menu.tsx");
const { default: AppShell } = await import("../app/components/app-shell.tsx");
const { default: DocumentCard } = await import("../app/components/document-card.tsx");
const { default: ReportTabs } = await import("../app/components/report-tabs.tsx");
const { default: DocumentLibrary } = await import("../app/reports/documents/page.tsx");
hook.deregister();
test("appearance cookies only accept the two themes and persist without financial or account data", () => {
  for (const input of [undefined, null, "LIGHT", "dark<script>", "dark; path=/", {}, ""]) assert.equal(readTheme(input), "light");
  assert.equal(themeFromCookies("session=secret; tcs-appearance=dark; other=value"), "dark");
  assert.equal(themeFromCookies("not-tcs-appearance=dark"), "light");
  assert.equal(themeFromCookies("tcs-appearance=dark%3Bbad"), "light");
  assert.equal(themeCookie("dark"), "tcs-appearance=dark; Path=/; Max-Age=31536000; SameSite=Lax");
  assert.ok(themeCookie("light", true).endsWith("; Secure"));
});
test("profile renders the server theme selection without an initially expanded settings menu", () => {
  for (const theme of ["light", "dark"]) {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { initialTheme: theme }, createElement(ProfileMenu)));
    const checked = [...html.matchAll(/<input\b[^>]*checked=""[^>]*value="([^"]+)"/g)].map(value => value[1]);
    assert.deepEqual(checked, [theme]);
    assert.equal(/<details\b[^>]*\bopen(?:=|\s|>)/.test(html), false);
    for (const path of ["/settings", "/settings/account", "/settings/business", "/settings/security", "/reminders"]) assert.ok(html.includes(`href="${path}"`));
    assert.ok(html.includes('aria-label="Open profile and settings"'));
  }
});
test("workspace navigation stays clear while settings remain in desktop and mobile profiles", () => {
  const html = renderToStaticMarkup(createElement(AppShell, { title: "Dashboard" }));
  const nav = html.match(/<nav[^>]*aria-label="Workspace navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  for (const path of ["/documents", "/settings", "/settings/account", "/settings/business", "/settings/security", "/reminders", "/clients", "/suppliers", "/tax/enquiries"]) assert.equal(nav.includes(`href="${path}"`), false);
  assert.ok(nav.includes('href="/reports"'));
  assert.equal((html.match(/aria-label="Open profile and settings"/g) || []).length, 2);
});
test("dashboard documents open in a separate tab and Reports keeps documents as its active view", () => {
  const card = renderToStaticMarkup(createElement(DocumentCard));
  const link = card.match(/<a\b[^>]*href="\/reports\/documents"[^>]*>/)?.[0];
  assert.ok(link?.includes('target="_blank"')); assert.ok(link?.includes('rel="noopener noreferrer"'));
  assert.ok(card.includes("opens in a new tab"));
  const tabs = renderToStaticMarkup(createElement(ReportTabs, { selected: "documents" }));
  assert.ok(tabs.match(/<a\b[^>]*aria-current="page"[^>]*href="\/reports\/documents"[^>]*>/));
  const library = renderToStaticMarkup(createElement(DocumentLibrary));
  assert.ok(library.includes("Document library")); assert.ok(library.includes("Opening your document library"));
  assert.ok(library.includes('type="search"'));
});
