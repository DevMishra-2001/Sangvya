// Labels and colors shared by several screens. A color is always shown next
// to its text label, never as the only cue.
import type { CandidateStage, DayFlag, LeaveType, Task } from "./types";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  leave: "Leave",
  cl: "Casual Leave (CL)",
  sl: "Sick Leave (SL)",
  ol: "Optional Leave (OL)",
  el: "Earned Leave (EL)",
  comp_off: "Comp Off",
};

export const SHORT_LEAVE_LABELS: Record<LeaveType, string> = { leave: "Leave", cl: "CL", sl: "SL", ol: "OL", el: "EL", comp_off: "Comp Off" };

// Leave types an employee applies for on a working day (comp off is earned by working a Sunday/holiday)
export const APPLY_LEAVE_TYPES = ["cl", "sl", "ol", "el", "comp_off"] as const;
export const BALANCE_TYPES = ["cl", "sl", "ol", "el", "comp_off"] as const;

export const ATTENDANCE_FLAGS: { key: DayFlag; label: string; color: string }[] = [
  { key: "online", label: "Online", color: "#16a34a" },
  { key: "offline", label: "Offline", color: "#dc2626" },
  { key: "leave_off", label: "Leave/Off", color: "#ea7317" },
  { key: "missing", label: "Missing Attendance", color: "#7c3aed" },
  { key: "short", label: "Short Attendance", color: "#0891b2" },
  { key: "forced_short", label: "Forcefully Short Attendance", color: "#2563eb" },
  { key: "long_break", label: "Long Break", color: "#eab308" },
  { key: "forced_long_break", label: "Forcefully Long Break", color: "#9333ea" },
];
export const FLAG_META = Object.fromEntries(ATTENDANCE_FLAGS.map((f) => [f.key, f])) as Record<DayFlag, (typeof ATTENDANCE_FLAGS)[number]>;

export const LOCATION_LABELS: Record<string, string> = {
  office: "Office",
  client_site: "Client Site",
  remote: "Work from home",
  office_client: "Office + Client",
  other: "Other",
};
export const LOCATION_OPTIONS = Object.entries(LOCATION_LABELS).map(([value, label]) => ({ value, label }));

// ---- Tickets ----
export type TicketStatus = "approved" | "done" | "in_progress" | "todo" | "overdue";
export const STATUS_ORDER: TicketStatus[] = ["approved", "done", "in_progress", "todo", "overdue"];
export const STATUS_META: Record<TicketStatus, { label: string; color: string }> = {
  approved: { label: "Approved", color: "var(--status-approved)" },
  done: { label: "Done", color: "var(--status-done)" },
  in_progress: { label: "In progress", color: "var(--status-progress)" },
  todo: { label: "To do", color: "var(--status-todo)" },
  overdue: { label: "Overdue", color: "var(--status-overdue)" },
};
export const PRIORITY_META = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/15 text-warning" },
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
} as const;

// The status a card shows: overdue wins over todo/in_progress
export const displayStatus = (task: Pick<Task, "overdue" | "status">): TicketStatus => (task.overdue ? "overdue" : task.status);

export const CANDIDATE_STAGES: { key: CandidateStage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
];

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

