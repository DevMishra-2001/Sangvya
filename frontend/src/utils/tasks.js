// Task status/priority display config. Colors are theme variables (index.css),
// validated per theme. Status colors were checked with the
// dataviz palette validator in this order (red never sits next to green), and
// every color is always shown with its text label — never color alone.
export const STATUS_ORDER = ["approved", "done", "in_progress", "todo", "overdue"];

export const STATUS_META = {
  approved:    { label: "Approved",    color: "var(--st-approved)", bg: "var(--stbg-approved)" },
  done:        { label: "Done",        color: "var(--st-done)",     bg: "var(--stbg-done)" },
  in_progress: { label: "In progress", color: "var(--st-progress)", bg: "var(--stbg-progress)" },
  todo:        { label: "To do",       color: "var(--st-todo)",     bg: "var(--stbg-todo)" },
  overdue:     { label: "Overdue",     color: "var(--st-overdue)",  bg: "var(--stbg-overdue)" },
};

export const PRIORITY_META = {
  high:   { label: "High",   className: "bg-rustbg text-rust" },
  medium: { label: "Medium", className: "bg-goldbg text-gold" },
  low:    { label: "Low",    className: "bg-line/50 text-slate" },
};

// The status a card shows: overdue wins over todo/in_progress.
export const displayStatus = (task) => (task.overdue ? "overdue" : task.status);

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
