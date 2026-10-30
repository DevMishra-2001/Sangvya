"use client";

// Month picker ("YYYY-MM"): opens like the DatePicker, but you pick a month
import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  allowFuture?: boolean; // default: up to the current month
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function MonthPicker({ value, onChange, allowFuture = false, id, placeholder = "Pick a month", invalid, disabled, className, ...rest }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const current = toMonth(new Date());
  const selectedYear = /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(0, 4)) : Number(current.slice(0, 4));
  const [year, setYear] = useState(selectedYear);
  const maxYear = allowFuture ? Number(current.slice(0, 4)) + 5 : Number(current.slice(0, 4));
  const label = /^\d{4}-\d{2}$/.test(value) ? `${SHORT[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}` : "";

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(selectedYear);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={rest["aria-label"]}
          aria-invalid={invalid || undefined}
          data-slot="date-picker"
          data-filled={label ? "true" : "false"}
          className={cn("h-9 w-full min-w-36 justify-between px-2.5 text-left font-normal dark:bg-input/30", !label && "text-muted-foreground", className)}
        >
          <span data-slot="field-value" className="truncate">
            {label || placeholder}
          </span>
          <CalendarIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setYear((y) => y + 1)} disabled={year >= maxYear} aria-label="Next year">
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SHORT.map((m, i) => {
            const key = `${year}-${String(i + 1).padStart(2, "0")}`;
            const future = !allowFuture && key > current;
            return (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={key === value ? "default" : "ghost"}
                disabled={future}
                className={cn("h-9", key === current && key !== value && "border border-primary/40")}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                {m}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// MonthPicker bound to a react-hook-form field
export function FormMonthPicker<T extends FieldValues, C = unknown, R = T>({
  control,
  name,
  ...props
}: Omit<MonthPickerProps, "value" | "onChange"> & { control: Control<T, C, R>; name: FieldPath<T> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => <MonthPicker {...props} value={field.value ?? ""} onChange={field.onChange} invalid={props.invalid ?? Boolean(fieldState.error)} />}
    />
  );
}
