// A labelled form control with its validation message underneath.
//   <FormField label="Email" error={errors.email}><Input {...register("email")} /></FormField>
import type { FieldError as RHFFieldError } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  description,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: RHFFieldError | { message?: string };
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={Boolean(error)} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}
