"use client";

// shadcn date picker (Popover + Calendar). Values are "YYYY-MM-DD" strings ("" = none),
// the same as the forms and API use.
//   <DatePicker value={date} onChange={setDate} max={today} />
//   <FormDatePicker control={control} name="joinDate" />  (react-hook-form)
import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// "2026-10-25" → local Date (not UTC midnight)
const toDate = (v: string | null | undefined) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return undefined;
  const [y, m, d] = v.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  // Month/year dropdowns in the header — handy for far-off dates like a birthday
  dropdowns?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function DatePicker({ value, onChange, id, min, max, placeholder = "Pick a date", dropdowns, clearable, disabled, invalid, className, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);
  const today = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative w-full", className)}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={rest["aria-label"]}
            aria-invalid={invalid || undefined}
            className={cn(
              "h-8 w-full justify-start px-2.5 text-left font-normal dark:bg-input/30",
              !selected && "text-muted-foreground",
              clearable && selected && "pr-8",
            )}
          >
            <CalendarIcon className="text-muted-foreground" />
            {selected ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : placeholder}
          </Button>
        </PopoverTrigger>
        {clearable && selected && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear date"
            className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate ?? today}
          onSelect={(d) => {
            if (!d) return;
            onChange(isoDate(d));
            setOpen(false);
          }}
          disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          captionLayout={dropdowns ? "dropdown" : "label"}
          startMonth={minDate ?? new Date(today.getFullYear() - 80, 0)}
          endMonth={maxDate ?? new Date(today.getFullYear() + 5, 11)}
        />
      </PopoverContent>
    </Popover>
  );
}

// DatePicker bound to a react-hook-form field
export function FormDatePicker<T extends FieldValues, C = unknown, R = T>({
  control,
  name,
  ...props
}: Omit<DatePickerProps, "value" | "onChange"> & { control: Control<T, C, R>; name: FieldPath<T> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DatePicker {...props} value={field.value ?? ""} onChange={field.onChange} invalid={props.invalid ?? Boolean(fieldState.error)} />
      )}
    />
  );
}
