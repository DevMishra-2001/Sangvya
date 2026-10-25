import { cn } from "@/lib/utils";

// Tone → colors. Every badge also shows its text, so color is never the only cue.
const TONES = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/25",
} as const;

export type Tone = keyof typeof TONES;

// Common statuses across the app → tone
const STATUS_TONES: Record<string, Tone> = {
  approved: "success",
  present: "success",
  paid: "success",
  active: "success",
  open: "success",
  acknowledged: "success",
  pending: "warning",
  half: "warning",
  submitted: "warning",
  trial: "info",
  rejected: "danger",
  absent: "danger",
  failed: "danger",
  past_due: "danger",
  cancelled: "danger",
  closed: "neutral",
  draft: "neutral",
  unset: "neutral",
};

export function StatusBadge({ status, tone, children, className }: { status?: string; tone?: Tone; children?: React.ReactNode; className?: string }) {
  const t = tone ?? STATUS_TONES[status ?? ""] ?? "neutral";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize", TONES[t], className)}>
      {children ?? status?.replace(/_/g, " ")}
    </span>
  );
}
