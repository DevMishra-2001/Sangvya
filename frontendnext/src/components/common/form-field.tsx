"use client";

// A form control with a floating label and its validation message underneath.
// The label sits inside the control like a placeholder and moves up onto the
// border on focus or once there's a value (styles: .ff in app/globals.css).
//   <FormField label="Email" htmlFor="email" error={errors.email}><Input id="email" {...register("email")} /></FormField>
// float={false} puts the label above instead — for things that aren't text boxes
// (image upload, star rating, toggle buttons). Inside a FormGrid, `span` sets the width.
import type { FieldError as RHFFieldError } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useFieldSpan, type FieldSpan } from "./form-layout";

export function FormField({
  label,
  htmlFor,
  error,
  description,
  required,
  float = true,
  span,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: RHFFieldError | { message?: string };
  description?: React.ReactNode;
  required?: boolean;
  float?: boolean;
  // Width inside a FormGrid
  span?: FieldSpan;
  className?: string;
  children: React.ReactNode;
}) {
  const cols = useFieldSpan(span);
  const text = (
    <>
      {label}
      {required && (
        <span className="ff-required" aria-hidden>
          *
        </span>
      )}
    </>
  );
  return (
    <Field data-invalid={Boolean(error)} className={cn("gap-1.5", cols, className)}>
      {float ? (
        <div className="ff">
          {children}
          <label htmlFor={htmlFor} className="ff-label">
            {text}
          </label>
        </div>
      ) : (
        <>
          <FieldLabel htmlFor={htmlFor}>{text}</FieldLabel>
          {children}
        </>
      )}
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={error ? [error] : undefined} />
    </Field>
  );
}
