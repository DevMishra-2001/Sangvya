"use client";

// Super Admin's message to everyone (maintenance, new features …). Hidden for this tab once closed.
import { useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const KEY = "wk-banner-closed";
const TONES = {
  info: { icon: Info, className: "border-info/30 bg-info/10 text-info" },
  warning: { icon: AlertTriangle, className: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning" },
  danger: { icon: Megaphone, className: "border-destructive/40 bg-destructive/10 text-destructive" },
} as const;

const readClosed = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function PlatformBanner() {
  const banner = useAuthStore((s) => s.platform?.banner ?? null);
  const [closed, setClosed] = useState<string | null>(readClosed);
  if (!banner || closed === banner.text) return null;
  const tone = TONES[banner.tone] ?? TONES.info;
  const Icon = tone.icon;
  return (
    <div role="status" className={cn("flex items-start gap-2 border-b px-4 py-2 text-sm sm:px-6", tone.className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1 text-foreground">{banner.text}</p>
      <button
        type="button"
        aria-label="Close message"
        className="rounded p-0.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, banner.text);
          } catch {
            // Private mode: it just closes for now
          }
          setClosed(banner.text);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
