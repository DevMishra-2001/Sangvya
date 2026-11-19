"use client";

// Select you can type into: click, type to filter, Enter/click to pick.
//   <SearchSelect value={city} onValueChange={setCity} options={cities} allowCustom />
// allowCustom keeps a typed value that isn't in the list (small towns, new names).
import { useId, useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectOption } from "./select-field";

const MAX_SHOWN = 150;
export const optionText = (o: SelectOption) => (typeof o.label === "string" ? o.label : o.value);

export function SearchSelect({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Type to search…",
  emptyLabel,
  allowCustom,
  size = "default",
  className,
  disabled,
  invalid,
  loading,
  ...rest
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  emptyLabel?: string;
  allowCustom?: boolean;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  // "" shows the empty choice's label (e.g. "All categories"), like the plain select did
  const selectedText = selected ? optionText(selected) : value || emptyLabel || "";
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const all: (SelectOption & { custom?: boolean })[] = [];
    if (emptyLabel && !q) all.push({ value: "", label: emptyLabel });
    const matches = q ? options.filter((o) => optionText(o).toLowerCase().includes(q)) : options;
    // Matches that start with the text come first
    if (q) matches.sort((a, b) => Number(!optionText(a).toLowerCase().startsWith(q)) - Number(!optionText(b).toLowerCase().startsWith(q)));
    all.push(...matches.slice(0, MAX_SHOWN));
    if (allowCustom && q && !options.some((o) => optionText(o).toLowerCase() === q)) all.push({ value: query.trim(), label: `Use “${query.trim()}”`, custom: true });
    return { list: all, more: matches.length - MAX_SHOWN };
  }, [options, q, query, emptyLabel, allowCustom]);

  function show() {
    if (disabled || open) return;
    setQuery("");
    setActive(Math.max(0, items.list.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(o: SelectOption) {
    if (o.disabled) return;
    onValueChange(o.value);
    setOpen(false);
    setQuery("");
  }

  function move(step: number) {
    const n = items.list.length;
    if (!n) return;
    const next = (active + step + n) % n;
    setActive(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const o = items.list[active];
      if (o) pick(o);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab" && open) {
      setOpen(false);
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => (o ? show() : setOpen(false))}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className={cn("relative w-full", className)}>
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={rest["aria-label"]}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            disabled={disabled}
            value={open ? query : selectedText}
            placeholder={open ? selectedText || (placeholder === "Select…" ? "Type to search…" : placeholder) : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (!open) setOpen(true);
            }}
            onMouseDown={show}
            onFocus={show}
            onBlur={() => {
              // Picking keeps focus here (the list blocks mousedown), so a blur means the user moved on
              setOpen(false);
              setQuery("");
            }}
            onKeyDown={onKeyDown}
            className={cn(
              size === "sm" ? "h-7 text-sm" : "h-9",
              "w-full min-w-0 truncate rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
            )}
          />
          <ChevronDown className={cn("pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => anchorRef.current?.contains(e.target as Node) && e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          className="z-50 w-(--radix-popper-anchor-width) min-w-44 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        >
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Loading…</p>
          ) : !items.list.length ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No match</p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
              {items.list.map((o, i) => (
                <li
                  key={`${o.custom ? "custom:" : ""}${o.value}`}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  onMouseMove={() => active !== i && setActive(i)}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm select-none",
                    i === active && "bg-accent text-accent-foreground",
                    o.disabled && "pointer-events-none opacity-50",
                    o.custom && "text-primary",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.value === value && !o.custom && <Check className="size-4 shrink-0" />}
                </li>
              ))}
              {items.more > 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">Type to see {items.more} more…</li>}
            </ul>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
