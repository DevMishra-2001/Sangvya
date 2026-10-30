"use client";

// Login, activation and company setup always look the same — white, with the
// default blue — whatever theme the user picked. Theming starts on the dashboard.
// While mounted this switches <html> to light + blue (so dropdowns and date
// pickers, which render outside the page, are light too) and puts the user's
// own theme back when they leave.
import { useLayoutEffect } from "react";
import { DEFAULT_ACCENT } from "@/lib/appearance";

export function ForceLight() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    const accent = html.getAttribute("data-accent");
    const scheme = html.style.colorScheme;
    html.classList.remove("dark");
    html.setAttribute("data-accent", DEFAULT_ACCENT);
    html.style.colorScheme = "light";
    return () => {
      if (wasDark) html.classList.add("dark");
      if (accent) html.setAttribute("data-accent", accent);
      else html.removeAttribute("data-accent");
      html.style.colorScheme = scheme;
    };
  }, []);
  return null;
}
