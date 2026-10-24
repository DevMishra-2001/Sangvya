import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import Tooltip from "../Tooltip";

// Sliding light/dark switch, wired to ThemeContext.
export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip content={label} placement="bottom">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Dark mode"
        onClick={toggleTheme}
        className={`relative h-9 w-[68px] rounded-full border border-line transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          isDark ? "bg-sidebar" : "bg-goldbg"
        }`}
      >
        {/* Track icons */}
        <Sun size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-opacity ${isDark ? "opacity-40 text-sidebarfg" : "opacity-0"}`} />
        <Moon size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity ${isDark ? "opacity-0" : "opacity-50 text-ink"}`} />
        {/* Sliding knob */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 left-1 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-transform duration-300 ${
            isDark ? "translate-x-[32px] bg-card" : "translate-x-0 bg-white"
          }`}
        >
          {isDark ? <Moon size={15} className="text-brass" /> : <Sun size={15} className="text-gold" />}
        </span>
      </button>
    </Tooltip>
  );
}
