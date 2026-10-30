// Status flags for one employee-day (the Attendance tab legend counts these).
//   online             checked in today, not checked out yet
//   offline            not working right now: checked out, or not checked in yet today
//   leave_off          approved leave, a weekly off or a holiday
//   missing            a past working day with no check-in and no leave
//   short              checked out with total time below the required hours
//   forced_short       a past day checked in but never checked out
//   long_break         breaks longer than allowed
//   forced_long_break  a break started on a past day and never ended

// Work mode picked at check-in ("remote" = work from home)
export const LOCATIONS = ["office", "client_site", "remote", "office_client", "other"] as const;

export type DayFlag = "online" | "offline" | "leave_off" | "missing" | "short" | "forced_short" | "long_break" | "forced_long_break";

interface DayLike {
  status: string;
  punchIn: Date | null;
  punchOut: Date | null;
  breaks: { end: Date | null }[];
  shortDay: boolean;
  longBreak: boolean;
}

interface DayFlagsInput {
  date: string;
  today: string;
  day: DayLike | null;
  holiday: unknown; // a holiday that's a day off (not an optional one)
  weeklyOff: boolean; // from the company's working days
  leaves: { status: string }[];
}

export function dayFlags({ date, today, day, holiday, weeklyOff, leaves }: DayFlagsInput): DayFlag[] {
  const flags = new Set<DayFlag>();
  const approvedLeave = leaves.find((l) => l.status === "approved");
  const offDay = weeklyOff || Boolean(holiday) || Boolean(approvedLeave);
  const past = date < today;

  if (day?.punchIn) {
    const openBreak = !day.punchOut && day.breaks.some((b) => !b.end);
    if (!day.punchOut) {
      if (past) {
        flags.add("forced_short");
        if (openBreak) flags.add("forced_long_break");
      } else {
        flags.add("online");
      }
    } else {
      flags.add("offline");
      if (day.shortDay) flags.add("short");
    }
    if (day.longBreak && !flags.has("forced_long_break")) flags.add("long_break");
  } else if (offDay) {
    flags.add("leave_off");
  } else if (day?.status === "present" || day?.status === "half") {
    flags.add("offline"); // marked by HR without punches
  } else if (past) {
    flags.add("missing");
  } else if (date === today) {
    flags.add("offline"); // not checked in yet
  }
  if (offDay && day?.punchIn) flags.add("leave_off");
  return [...flags];
}

// The single word shown in the Status column
export function primaryStatus(flags: DayFlag[]) {
  if (flags.includes("online")) return "online";
  if (flags.includes("forced_short")) return "forced_short";
  if (flags.includes("short")) return "short";
  if (flags.includes("missing")) return "missing";
  if (flags.includes("leave_off") && !flags.includes("offline")) return "leave_off";
  if (flags.includes("offline")) return "offline";
  return "none";
}
