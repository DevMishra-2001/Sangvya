"use client";

import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, PanelLeft, PanelTop, Sun } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCENTS, FONT_SIZE } from "@/lib/appearance";
import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useAuthStore } from "@/stores/auth-store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const MODES = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
] as const;

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-2 text-2xs font-semibold tracking-wider text-muted-foreground uppercase", className)}>{children}</div>;
}

const ON = "w-full data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

function ModePicker() {
  const { theme, setTheme } = useTheme();
  const savePreferences = useAuthStore((s) => s.savePreferences);
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={theme ?? "system"}
      onValueChange={(v) => {
        if (!v) return;
        setTheme(v);
        savePreferences({ theme: v as "light" | "dark" | "system" });
      }}
      aria-label="Color mode"
      className="grid w-full grid-cols-3"
    >
      {MODES.map(({ key, label, icon: Icon }) => (
        <ToggleGroupItem key={key} value={key} className={ON}>
          <Icon /> {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function AccentPicker() {
  const accent = useAppearanceStore((s) => s.accent);
  const setAccent = useAppearanceStore((s) => s.setAccent);
  const savePreferences = useAuthStore((s) => s.savePreferences);
  return (
    <div className="grid grid-cols-7 gap-2" role="radiogroup" aria-label="Accent color">
      {ACCENTS.map((a) => (
        <Tooltip key={a.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={accent === a.key}
              aria-label={a.label}
              onClick={() => {
                setAccent(a.key);
                savePreferences({ accent: a.key });
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-shadow",
                accent === a.key ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border",
              )}
              style={{ background: a.swatch }}
            >
              {accent === a.key && <Check className="size-3.5 text-white" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{a.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// Font size 10–17 (13 = normal). Dragging previews live; letting go saves it to
// this user's own account, so it follows them to any device.
function FontSizePicker() {
  const saved = useAuthStore((s) => s.user?.font_size ?? FONT_SIZE.default);
  const previewFontSize = useAuthStore((s) => s.previewFontSize);
  const saveFontSize = useAuthStore((s) => s.saveFontSize);
  const lastSaved = useRef(saved);
  // While dragging the slider shows the drag value; otherwise the saved size
  const [dragging, setDragging] = useState<number | null>(null);
  const value = dragging ?? saved;

  async function commit(v: number) {
    setDragging(null);
    if (v === lastSaved.current) return;
    if (await saveFontSize(v)) lastSaved.current = v;
    else previewFontSize(lastSaved.current); // roll back the preview
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground" aria-hidden>
          A
        </span>
        <Slider
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step={1}
          value={[value]}
          onValueChange={([v]) => {
            setDragging(v);
            previewFontSize(v);
          }}
          onValueCommit={([v]) => commit(v)}
          aria-label="Font size"
        />
        <span className="text-base text-muted-foreground" aria-hidden>
          A
        </span>
      </div>
      <div className="mt-1.5 text-center text-xs text-muted-foreground tabular-nums">
        {value}px{value === FONT_SIZE.default && " · default"}
      </div>
    </div>
  );
}

// Sidebar on the left, or a menu bar across the top (desktop)
function LayoutPicker() {
  const layout = useAuthStore((s) => s.user?.menu_layout ?? "vertical");
  const savePreferences = useAuthStore((s) => s.savePreferences);
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={layout}
      onValueChange={(v) => v && savePreferences({ menu_layout: v as "vertical" | "horizontal" })}
      aria-label="Menu layout"
      className="grid w-full grid-cols-2"
    >
      <ToggleGroupItem value="vertical" className={ON}>
        <PanelLeft /> Sidebar
      </ToggleGroupItem>
      <ToggleGroupItem value="horizontal" className={ON}>
        <PanelTop /> Top menu
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

// Mode, accent color, font size and menu layout — saved to the account (shown in the profile panel)
export function AppearanceSettings() {
  return (
    <div>
      <SectionTitle>Mode</SectionTitle>
      <ModePicker />
      <SectionTitle className="mt-5">Accent color</SectionTitle>
      <AccentPicker />
      <SectionTitle className="mt-5">Font size</SectionTitle>
      <FontSizePicker />
      <SectionTitle className="mt-5">Menu layout</SectionTitle>
      <LayoutPicker />
    </div>
  );
}
