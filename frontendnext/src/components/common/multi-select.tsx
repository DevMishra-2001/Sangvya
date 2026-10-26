"use client";

// Pick several options from a dropdown list with checkboxes (shadcn Popover + Checkbox).
//   <MultiSelect value={ids} onChange={setIds} options={[{ value: "1", label: "Admin" }]} />
//   <FormMultiSelect control={control} name="designationIds" options={…} />  (react-hook-form)
// Works with FormField's floating label (data-filled tells it there's a value).
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
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
}

export function MultiSelect({ value, onChange, options, id, placeholder = "Select…", invalid, disabled, className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const allSelected = selected.length === options.length && options.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          data-filled={selected.length ? "true" : "false"}
          className={cn("h-auto min-h-9 w-full justify-between gap-2 px-2.5 py-1 font-normal dark:bg-input/30", className)}
        >
          <span data-slot="field-value" className={cn("flex min-w-0 flex-1 flex-wrap gap-1", !selected.length && "text-muted-foreground")}>
            {selected.length
              ? selected.map((o) => (
                  <Badge key={o.value} variant="secondary" className="gap-1 pr-1">
                    {o.label}
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
                ))
              : placeholder}
          </span>
          <ChevronDown className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-1">
        <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent"
            onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label
                key={o.value}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(o.value)} />
                {o.label}
              </label>
            );
          })}
        </div>
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
