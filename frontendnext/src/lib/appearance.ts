// Appearance options. Light/dark mode is handled by next-themes; the accent is
// applied as data-accent on <html> and the font size as --font-scale (see globals.css).

export const ACCENTS = [
  { key: "neutral", label: "Neutral", swatch: "oklch(0.3 0 0)" },
  { key: "blue", label: "Blue", swatch: "oklch(0.546 0.245 262.881)" },
  { key: "green", label: "Green", swatch: "oklch(0.627 0.194 149.214)" },
  { key: "red", label: "Red", swatch: "oklch(0.577 0.245 27.325)" },
  { key: "orange", label: "Orange", swatch: "oklch(0.646 0.222 41.116)" },
  { key: "violet", label: "Violet", swatch: "oklch(0.541 0.281 293.009)" },
  { key: "rose", label: "Rose", swatch: "oklch(0.586 0.253 17.585)" },
] as const;

export type Accent = (typeof ACCENTS)[number]["key"];

export const DEFAULT_ACCENT: Accent = "blue";
export const ACCENT_STORAGE_KEY = "sangvya-accent";

export function applyAccent(accent: Accent) {
  if (accent === "neutral") delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

// Font size: 13 = normal (scale 1). Only text sizes scale, never spacing.
export const FONT_SIZE = { min: 10, max: 17, default: 13 };

export function applyFontSize(size: number) {
  document.documentElement.style.setProperty("--font-scale", String(size / FONT_SIZE.default));
}
