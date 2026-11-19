"use client";

// Pick several options: search box, "select all" for what's shown, and a checkbox list.
//   <MultiSelect value={ids} onChange={setIds} options={[{ value: "1", label: "Admin" }]} />
//   <FormMultiSelect control={control} name="designationIds" options={…} />  (react-hook-form)
// Works with FormField's floating label (data-filled tells it there's a value).
import { useId, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const CHIPS = 2;

export function MultiSelect({ value, onChange, options, id, placeholder = "Select…", invalid, disabled, className, ...rest }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const pickable = shown.filter((o) => !o.disabled);
  const allOn = pickable.length > 0 && pickable.every((o) => value.includes(o.value));
  const someOn = pickable.some((o) => value.includes(o.value));
  // Select all / none applies to what the search shows
  const toggleAll = () => {
    const ids = pickable.map((o) => o.value);
    onChange(allOn ? value.filter((v) => !ids.includes(v)) : [...value, ...ids.filter((v) => !value.includes(v))]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={rest["aria-label"]}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          data-filled={selected.length ? "true" : "false"}
          className={cn(
            "flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-transparent py-1 pr-2 pl-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
            className,
          )}
        >
          <span data-slot="field-value" className={cn("flex min-w-0 flex-1 flex-wrap gap-1", !selected.length && "text-muted-foreground")}>
            {selected.length
              ? [
                  ...selected.slice(0, CHIPS).map((o) => (
                    <Badge key={o.value} variant="secondary" className="max-w-40 gap-1 pr-1">
                      <span className="truncate">{o.label}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Remove ${o.label}`}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(o.value);
                        }}
                        className="rounded-sm opacity-70 hover:opacity-100"
                      >
                        <X className="size-3" />
                      </span>
                    </Badge>
                  )),
                  selected.length > CHIPS && (
                    <Badge key="more" variant="outline">
                      +{selected.length - CHIPS} more
                    </Badge>
                  ),
                ]
              : placeholder}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-60 gap-0 p-0">
        <div className="flex items-center gap-2.5 border-b bg-muted/40 p-2">
          <Checkbox checked={allOn ? true : someOn ? "indeterminate" : false} onCheckedChange={toggleAll} disabled={!pickable.length} aria-label="Select all shown" className="ml-1.5" />
          <div className="relative flex-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search options"
              className="h-8 w-full rounded-md border border-input bg-background pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <Search className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <div id={listId} role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto p-1">
          {shown.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label
                key={o.value}
                role="option"
                aria-selected={checked}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent", o.disabled && "pointer-events-none opacity-50")}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(o.value)} disabled={o.disabled} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </label>
            );
          })}
          {!shown.length && <p className="px-2 py-2 text-sm text-muted-foreground">No match</p>}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
            <span>{selected.length} selected</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// MultiSelect bound to a react-hook-form field holding a string[]
export function FormMultiSelect<T extends FieldValues, C = unknown, R = T>({
  control,
  name,
  ...props
}: Omit<MultiSelectProps, "value" | "onChange"> & { control: Control<T, C, R>; name: FieldPath<T> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MultiSelect {...props} value={field.value ?? []} onChange={field.onChange} invalid={props.invalid ?? Boolean(fieldState.error)} />
      )}
    />
  );
}
