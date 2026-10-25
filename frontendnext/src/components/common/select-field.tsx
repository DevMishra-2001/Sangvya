"use client";

// shadcn Select with a plain list of options.
//   <SelectField value={status} onValueChange={setStatus} options={[{ value: "open", label: "Open" }]} />
// emptyLabel adds a "none" choice whose value is "" (Radix items can't use "" themselves).
//   <FormSelect control={control} name="managerId" options={…} emptyLabel="— None —" />  (react-hook-form)
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  emptyLabel?: string;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
}

export function SelectField({ value, onValueChange, options, id, placeholder = "Select…", emptyLabel, size, className, disabled, invalid, ...rest }: SelectFieldProps) {
  const current = value === "" || value == null ? (emptyLabel ? NONE : "") : value;
  return (
    <Select value={current} onValueChange={(v) => onValueChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} size={size} aria-label={rest["aria-label"]} aria-invalid={invalid || undefined} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// SelectField bound to a react-hook-form field (form values are strings)
export function FormSelect<T extends FieldValues, C = unknown, R = T>({
  control,
  name,
  ...props
}: Omit<SelectFieldProps, "value" | "onValueChange"> & { control: Control<T, C, R>; name: FieldPath<T> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectField {...props} value={field.value ?? ""} onValueChange={field.onChange} invalid={props.invalid ?? Boolean(fieldState.error)} />
      )}
    />
  );
}
