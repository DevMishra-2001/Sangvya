// Labels and colors for the attendance screens (legend dots always sit next to
// their text label, so color is never the only cue).
export const ATTENDANCE_FLAGS = [
  { key: "online", label: "Online", color: "#16a34a" },
  { key: "offline", label: "Offline", color: "#dc2626" },
  { key: "leave_off", label: "Leave/Off", color: "#ea7317" },
  { key: "missing", label: "Missing Attendance", color: "#7c3aed" },
  { key: "short", label: "Short Attendance", color: "#0891b2" },
  { key: "forced_short", label: "Forcefully Short Attendance", color: "#2563eb" },
  { key: "long_break", label: "Long Break", color: "#eab308" },
  { key: "forced_long_break", label: "Forcefully Long Break", color: "#9333ea" },
];

export const FLAG_META = Object.fromEntries(ATTENDANCE_FLAGS.map((f) => [f.key, f]));

export const LOCATION_LABELS = {
  office: "Office",
  client_site: "Client Site",
  remote: "Remote / Home",
  office_client: "Office+Client",
};

export const LOCATION_OPTIONS = Object.entries(LOCATION_LABELS).map(([value, label]) => ({ value, label }));

// "Oct-2026" style label for a "YYYY-MM" month
export function monthLabel(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }).replace(" ", "-");
}

// Date → "YYYY-MM" (local)
export function toMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
