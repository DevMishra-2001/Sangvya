import { useEffect, useRef, useState } from "react";
import { Settings, Type, ChevronLeft } from "lucide-react";
import Tooltip from "../Tooltip";
import FontSizeSetting from "./FontSizeSetting";

// Items in the Settings list. To add a new setting: build its panel component
// in this folder and add one entry here (available to every role).
//   icon      lucide icon shown on the left
//   label     name shown in the middle of the row, and as the panel title
//   Component panel that opens when the item is clicked
const SETTINGS_ITEMS = [
  { key: "fontSize", icon: Type, label: "Font Size", Component: FontSizeSetting },
];

// One row: icon (left column) · name (centered). Same 38px height as the title bar.
function ItemRow({ item, onOpen }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onOpen}
      className="w-full grid grid-cols-[1.75rem_1fr_1.75rem] items-center px-2 h-[38px] rounded-lg border border-transparent hover:border-line hover:bg-ivory transition-colors"
    >
      <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Icon size={14} />
      </span>
      <span className="text-sm font-medium text-ink text-center">{item.label}</span>
      <span aria-hidden /> {/* empty right column keeps the name centered */}
    </button>
  );
}

// Gear button in the header: opens a list of settings; clicking one opens its panel.
export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(null); // null = list view
  const ref = useRef(null);
  const active = SETTINGS_ITEMS.find((i) => i.key === activeKey);

  function close() {
    setOpen(false);
    setActiveKey(null);
  }

  // Close on outside click; Escape goes back to the list, then closes
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (activeKey) setActiveKey(null);
      else close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, activeKey]);

  return (
    <div ref={ref} className="relative">
      <Tooltip content="Settings" placement="bottom">
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`w-9 h-9 flex items-center justify-center border rounded-lg transition-colors ${
            open ? "border-primary bg-primary/10 text-primary" : "border-line bg-card text-ink hover:bg-ivory"
          }`}
        >
          <Settings size={16} className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
        </button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-card border border-line rounded-xl overflow-hidden z-50 animate-[tooltip-in_120ms_ease-out]"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          {/* Title bar: "Settings" in the list, "← <item>" inside a panel */}
          <div className="flex items-center gap-1.5 px-3 h-[38px] border-b border-line">
            {active ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveKey(null)}
                  className="p-1 -ml-1 rounded-md text-slate hover:text-ink hover:bg-ivory"
                  aria-label="Back to settings"
                >
                  <ChevronLeft size={17} />
                </button>
                <active.icon size={15} className="text-primary" />
                <span className="text-sm font-semibold text-ink">{active.label}</span>
              </>
            ) : (
              <span className="px-1 text-2xs uppercase tracking-wider font-semibold text-slate">Settings</span>
            )}
          </div>

          {active ? (
            <active.Component key={active.key} />
          ) : (
            <div className="p-1 flex flex-col gap-0.5">
              {SETTINGS_ITEMS.map((item) => (
                <ItemRow key={item.key} item={item} onOpen={() => setActiveKey(item.key)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
