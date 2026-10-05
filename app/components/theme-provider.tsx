"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readTheme, themeCookie, themeFromCookies, type Theme } from "../../lib/theme";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: "light", setTheme() {} });
export const useTheme = () => useContext(ThemeContext);
export default function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, updateTheme] = useState(initialTheme);
  useEffect(() => {
    // The server paints the saved cookie preference before hydration.
    const sync = () => { const value = themeFromCookies(document.cookie); document.documentElement.dataset.theme = value; updateTheme(value); };
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  function setTheme(value: Theme) {
    const next = readTheme(value);
    document.documentElement.dataset.theme = next;
    document.cookie = themeCookie(next, window.location.protocol === "https:");
    updateTheme(next);
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
