/** @type {import('tailwindcss').Config} */

// Every color is a CSS variable (RGB triplet, defined in src/index.css) so the
// same class — e.g. `bg-card` — switches between light and dark themes.
// ThemeContext toggles the `dark` class on <html>.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

// Text sizes scale with the user's font-size setting via --font-scale (set on
// <html> by hooks/useFontSize.js). Only TEXT grows/shrinks — spacing, widths and
// heights stay in plain rem, so the layout never shifts. Line heights are
// unitless so they scale with the text.
const fs = (rem, lineHeight) => [`calc(${rem}rem * var(--font-scale, 1))`, { lineHeight }];

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    fontSize: {
      "3xs": fs(0.625, "1.4"),    // 10px
      "2xs": fs(0.6875, "1.45"),  // 11px
      xs: fs(0.75, "1.5"),        // 12px
      sm: fs(0.875, "1.45"),      // 14px
      base: fs(1, "1.5"),         // 16px
      lg: fs(1.125, "1.45"),      // 18px
      h2: fs(1.1875, "1.35"),     // 19px — section headings
      xl: fs(1.25, "1.4"),        // 20px
      greet: fs(1.375, "1.3"),    // 22px — header greeting
      "2xl": fs(1.5, "1.3"),      // 24px
      h1: fs(1.625, "1.25"),      // 26px — page titles
      "3xl": fs(1.875, "1.2"),    // 30px
      "4xl": fs(2.25, "1.15"),    // 36px
    },
    extend: {
      colors: {
        ink: token("ink"),         // primary text, primary button
        ivory: token("ivory"),     // page background
        card: token("card"),       // card / panel surface
        brass: token("brass"),     // accent
        slate: token("slate"),     // secondary text
        line: token("line"),       // borders
        leaf: token("leaf"),       // success/present
        leafbg: token("leafbg"),
        rust: token("rust"),       // danger/absent
        rustbg: token("rustbg"),
        gold: token("gold"),       // warning/half-day/pending
        goldbg: token("goldbg"),
        primary: token("primary"),     // brand green: buttons, active states
        primaryfg: token("primaryfg"), // text on primary
        sidebar: token("sidebar"),     // sidebar background (gradient top)
        sidebar2: token("sidebar2"),   // sidebar gradient bottom
        sidebarfg: token("sidebarfg"), // sidebar text
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
