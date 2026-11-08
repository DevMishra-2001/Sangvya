"use client";

// One layout for every form, so pages and dialogs look the same:
//
//   <FormCard title="Change Password" icon={KeyRound}>
//     <FormGrid>
//       <FieldSeparator label="Basic details" />
//       <FormField label="Name">…</FormField>          ← 6 per row on wide screens (2 of 12 columns)
//       <FormField label="Address" span="md">…</FormField>  ← twice as wide
//       <FormActions><Button>Save</Button></FormActions>   ← sits in the row, lined up with the inputs
//     </FormGrid>
//   </FormCard>
//
// Inside a dialog use <FormGrid density="dialog"> (4 per row) with <DialogContent className={FORM_DIALOG}>.
import { createContext, useContext } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FieldSpan = "sm" | "md" | "lg" | "full";
type Density = "page" | "dialog";

const SPANS: Record<Density, Record<FieldSpan, string>> = {
  page: {
    sm: "col-span-12 sm:col-span-6 lg:col-span-4 xl:col-span-2",
    md: "col-span-12 lg:col-span-8 xl:col-span-4",
    lg: "col-span-12 xl:col-span-6",
    full: "col-span-12",
  },
  dialog: {
    sm: "col-span-12 sm:col-span-6 lg:col-span-3",
    md: "col-span-12 sm:col-span-12 lg:col-span-6",
    lg: "col-span-12 lg:col-span-9",
    full: "col-span-12",
  },
};

// Wide dialog that fits 4 fields per row
export const FORM_DIALOG = "max-h-[90vh] overflow-y-auto sm:max-w-6xl";

const GridContext = createContext<Density | null>(null);

// Column classes for a field of this width (empty outside a FormGrid)
export function useFieldSpan(span: FieldSpan = "sm") {
  const density = useContext(GridContext);
  return density ? SPANS[density][span] : "";
}

export function FormGrid({ density = "page", className, children }: { density?: Density; className?: string; children: React.ReactNode }) {
  return (
    <GridContext.Provider value={density}>
      <div className={cn("grid grid-cols-12 items-start gap-x-3 gap-y-4", className)}>{children}</div>
    </GridContext.Provider>
  );
}

// Card with a thin heading strip on top
export function FormCard({
  title,
  icon: Icon,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("ff-surface-card overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs", className)}>
      <FormHeading title={title} icon={Icon} actions={actions} />
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}

// The heading strip on its own (e.g. above a table)
export function FormHeading({ title, icon: Icon, actions }: { title: string; icon?: LucideIcon; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-b bg-primary/8 px-3 py-0.5">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {Icon && <Icon className="size-3.5 shrink-0 text-primary" />}
        <span className="truncate">{title}</span>
      </h2>
      {actions && <div className="flex flex-wrap items-center gap-1.5 [&_[data-slot=button]]:h-6 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-xs">{actions}</div>}
    </div>
  );
}

// A named divider that groups the fields after it: ── Basic details ─────
export function FieldSeparator({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("col-span-12 flex items-center gap-3 pt-1 first:pt-0", className)} role="separator" aria-label={label}>
      <span className="text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-primary uppercase">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// Buttons placed in the field row, the same height as the inputs
export function FormActions({ span = "sm", className, children }: { span?: FieldSpan; className?: string; children: React.ReactNode }) {
  const cols = useFieldSpan(span);
  return <div className={cn(cols, "flex items-start gap-2 [&_[data-slot=button]]:h-9", className)}>{children}</div>;
}
