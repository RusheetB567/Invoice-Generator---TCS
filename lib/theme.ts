export type Theme = "light" | "dark";
export const THEME_COOKIE = "tcs-appearance";
export function readTheme(value: unknown): Theme { return value === "dark" ? "dark" : "light"; }
export function themeFromCookies(cookies: string): Theme {
  return readTheme(cookies.split(";").map(part => part.trim()).find(part => part.startsWith(`${THEME_COOKIE}=`))?.slice(THEME_COOKIE.length + 1));
}
export function themeCookie(theme: Theme, secure = false) {
  return `${THEME_COOKIE}=${readTheme(theme)}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
