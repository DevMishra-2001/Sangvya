// Working-day rules and helpers shared by punch in/out, the calendar and leave.
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const REQUIRED_MINUTES = Number(process.env.REQUIRED_WORK_HOURS || 9) * 60; // punch in -> punch out, breaks included
const MAX_BREAK_MINUTES = Number(process.env.MAX_BREAK_MINUTES || 60);

// "YYYY-MM-DD" for a moment, in the company's timezone (not the server's).
function localDate(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// "09:42" for a timestamp, in the company's timezone.
function localTime(date) {
  return new Date(date).toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
}

function isSunday(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay() === 0;
}

const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

// Totals for one attendance row + its breaks. Open punches/breaks count up to `now`.
function summarize(record, breaks, now = new Date()) {
  if (!record?.punch_in) {
    return { totalMinutes: 0, breakMinutes: 0, workMinutes: 0, onBreak: false, shortDay: false, longBreak: false };
  }
  const end = record.punch_out || now;
  const totalMinutes = minutesBetween(record.punch_in, end);
  const breakMinutes = breaks.reduce((sum, b) => sum + minutesBetween(b.break_start, b.break_end || end), 0);
  return {
    totalMinutes,
    breakMinutes,
    workMinutes: Math.max(0, totalMinutes - breakMinutes),
    onBreak: !record.punch_out && breaks.some((b) => !b.break_end),
    // Only judged once the day is closed
    shortDay: Boolean(record.punch_out) && totalMinutes < REQUIRED_MINUTES,
    longBreak: breakMinutes > MAX_BREAK_MINUTES,
  };
}

function formatMinutes(min) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

module.exports = {
  TIMEZONE, REQUIRED_MINUTES, MAX_BREAK_MINUTES,
  localDate, localTime, isSunday, summarize, formatMinutes,
};
