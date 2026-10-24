import { useEffect } from "react";
import { useSelector } from "react-redux";

// Font size setting: 13 = the app's normal size (scale 1). It sets the CSS
// variable --font-scale, which only the text sizes use (tailwind.config.js
// fontSize) — spacing, widths and heights don't change, so the layout stays put.
// The value comes from the logged-in user's account (font_size); nothing is
// cached in localStorage.
export const FONT_SIZE = { min: 10, max: 17, default: 13 };

export function applyFontSize(size) {
  document.documentElement.style.setProperty("--font-scale", String(size / FONT_SIZE.default));
}

// Keeps <html> in sync with the logged-in user's own saved font size.
export default function useFontSize() {
  const size = useSelector((state) => state.auth.user?.font_size);

  useEffect(() => {
    applyFontSize(size ?? FONT_SIZE.default); // logged out → default size
  }, [size]);
}
