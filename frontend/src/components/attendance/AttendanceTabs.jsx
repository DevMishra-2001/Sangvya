import { NavLink } from "react-router-dom";
import { Gauge } from "lucide-react";

export const ATTENDANCE_TABS = [
  { to: "/my-attendance", label: "Attendance", end: true },
  { to: "/my-attendance/calendar", label: "Attendance Calendar" },
  { to: "/my-attendance/report", label: "Attendance Report" },
  { to: "/my-attendance/leaves", label: "Leave View Approval" },
];

// Tab strip across the top of the four My Attendance pages.
export default function AttendanceTabs() {
  return (
    <nav className="flex flex-wrap gap-1 border-b-2 border-primary/60 mb-4" aria-label="My Attendance">
      {ATTENDANCE_TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm transition-colors ${
              isActive ? "bg-primary text-primaryfg" : "text-primary hover:bg-primary/10"
            }`
          }
        >
          <Gauge size={15} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

// Title strip used under the tabs ("HR / Attendance Calendar" + right side content)
export function PageStrip({ title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border-y border-primary/20 rounded-t-xl">
      <h2 className="!mb-0 !text-sm font-sans font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}
