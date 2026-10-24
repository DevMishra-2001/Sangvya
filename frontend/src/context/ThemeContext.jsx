import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// App-wide light/dark theme. The choice is saved per browser; with no saved
// choice we follow the OS setting. The theme is applied by toggling the `dark`
// class on <html>, which swaps the CSS color variables in index.css.
const STORAGE_KEY = "sangvya_theme";

const ThemeContext = createContext(null);

function readSaved() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [saved, setSaved] = useState(readSaved);     // explicit user choice, or null
  const [system, setSystem] = useState(systemTheme); // OS preference
  const theme = saved || system;

  // Follow OS changes while the user hasn't picked a theme
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((next) => {
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  const value = useMemo(() => ({ theme, isDark: theme === "dark", setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// const { theme, isDark, toggleTheme, setTheme } = useTheme();
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
