"use client";

// Keyboard shortcuts for the whole app + the "?" help popup.
//   Ctrl/⌘+K  command palette (works everywhere)
//   ?          this help        /   the page's search box
//   g d, g t…  go to a page     n t, n l…  start something     c i  check in / out
// Ignored while typing in a field, and while a dialog is open.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommandStore } from "@/stores/command-store";
import { keyLabel, useCommands, type CommandEntry } from "./commands";

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
};
const dialogOpen = () =>
  Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));
const isMac = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export function useKeyboardShortcuts() {
  const router = useRouter();
  const commands = useCommands();
  const setPalette = useCommandStore((s) => s.setPalette);
  const setHelp = useCommandStore((s) => s.setHelp);
  const pending = useRef<{ key: string; at: number } | null>(null);
  const latest = useRef(commands);
  useEffect(() => {
    latest.current = commands;
  }, [commands]);

  useEffect(() => {
    const run = (c: CommandEntry) => {
      if (c.event) window.dispatchEvent(new Event(c.event));
      else if (c.href) router.push(c.href);
    };
    function onKey(e: KeyboardEvent) {
      // Command palette, from anywhere
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        const open = useCommandStore.getState().palette;
        setPalette(!open);
        return;
      }
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat ||
        isTyping(e.target) ||
        dialogOpen()
      )
        return;

      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (e.key === "/") {
        const box = document.querySelector<HTMLElement>("[data-page-search]");
        if (box) {
          e.preventDefault();
          box.focus();
        }
        return;
      }

      const key = e.key.toLowerCase();
      const first =
        pending.current && Date.now() - pending.current.at < 1200
          ? pending.current.key
          : null;
      if (first) {
        pending.current = null;
        const match = latest.current.find(
          (c) => c.keys?.[0] === first && c.keys?.[1] === key,
        );
        if (match) {
          e.preventDefault();
          run(match);
        }
        return;
      }
      if (latest.current.some((c) => c.keys?.[0] === key))
        pending.current = { key, at: Date.now() };
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setPalette, setHelp]);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
      {children}
    </kbd>
  );
}

function Row({
  keys,
  label,
  then,
}: {
  keys: string[];
  label: string;
  then?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {then ? "then" : "+"}
              </span>
            )}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

export function ShortcutsHelp() {
  const open = useCommandStore((s) => s.help);
  const setOpen = useCommandStore((s) => s.setHelp);
  const commands = useCommands().filter((c) => c.keys);
  const mod = isMac() ? "⌘" : "Ctrl";
  const section = (title: string, items: CommandEntry[]) =>
    items.length > 0 && (
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        <div className="divide-y">
          {items.map((c) => (
            <Row key={c.id} label={c.label} keys={keyLabel(c.keys!)} then />
          ))}
        </div>
      </div>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press two keys one after the other, e.g. G then T for Tickets. They
            don&apos;t work while you&apos;re typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              General
            </h3>
            <div className="divide-y">
              <Row label="Search pages, actions, people" keys={[mod, "K"]} />
              <Row label="Search on this page" keys={["/"]} />
              <Row label="This help" keys={["?"]} />
              <Row label="Close a popup" keys={["Esc"]} />
            </div>
          </div>
          {section(
            "Go to",
            commands.filter((c) => c.group === "Go to"),
          )}
          {section(
            "Create",
            commands.filter((c) => c.group === "Create"),
          )}
          {section(
            "Attendance",
            commands.filter((c) => c.group === "Attendance"),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
