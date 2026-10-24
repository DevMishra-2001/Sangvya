// Status flags for one employee-day (the Attendance tab legend counts these).
//   online             checked in today, not checked out yet
//   offline            not working right now: checked out, or not checked in yet today
//   leave_off          approved leave, Sunday or holiday
//   missing            a past working day with no check-in and no leave
//   short              checked out with total time below the required hours
//   forced_short       a past day checked in but never checked out (the day was closed without a check-out)
//   long_break         breaks longer than allowed
//   forced_long_break  a break started on a past day and never ended
const { isSunday } = require("./workday");

const LOCATIONS = ["office", "client_site", "remote", "office_client"];

// day = dayPayload (or null); leaves = this employee's requests covering the date
function dayFlags({ date, today, day, holiday, leaves = [] }) {
  const flags = new Set();
  const approvedLeave = leaves.find((l) => l.status === "approved");
  const offDay = isSunday(date) || Boolean(holiday) || Boolean(approvedLeave);
  const past = date < today;

  if (day?.punchIn) {
    const openBreak = !day.punchOut && day.breaks?.some((b) => !b.end);
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

// The single word shown in the Status column.
function primaryStatus(flags) {
  if (flags.includes("online")) return "online";
  if (flags.includes("forced_short")) return "forced_short";
  if (flags.includes("short")) return "short";
  if (flags.includes("missing")) return "missing";
  if (flags.includes("leave_off") && !flags.includes("offline")) return "leave_off";
  if (flags.includes("offline")) return "offline";
  return "none";
}

module.exports = { LOCATIONS, dayFlags, primaryStatus };
