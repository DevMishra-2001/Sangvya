import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCalendar } from "../../store/slices/selfSlice";
import AttendanceTabs, { PageStrip } from "../../components/attendance/AttendanceTabs";
import DayModal from "../../components/attendance/DayModal";
import { Input, DatePicker, Button } from "../../components/formComponent";
import { SHORT_LEAVE_LABELS, BALANCE_TYPES, isoDate } from "../../utils/workday";
import { toMonth } from "../../utils/attendanceMeta";

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const REQUIRED_WORK_MIN = 9 * 60;      // Work Hours below this show red
const REQUIRED_EFFECTIVE_MIN = 8 * 60; // Effective Hours (minus breaks) below this show red

const LEGEND = [
  { cls: "cal-pending", label: "Pending Approval" },
  { cls: "cal-approved", label: "Approved Leave" },
  { cls: "cal-holiday", label: "Gazetted/Restricted Holiday" },
  { cls: "cal-optional", label: "Optional Leave" },
  { cls: "cal-missing", label: "Missing Attendance" },
  { cls: "cal-working", label: "Working Day" },
];

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const time12 = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// Calendar cells, Sunday-first, padded with nulls before day 1.
function buildCells(month) {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(y, m - 1, 1).getDay(); // Sun=0
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) cells.push(isoDate(new Date(y, m - 1, d)));
  return cells;
}

// Background class + content for one day
function dayLook({ date, today, sunday, day, holiday, leaves }) {
  const leave = leaves.find((l) => l.status !== "rejected");
  if (day?.punchIn) return { cls: "cal-working" };
  if (holiday) return { cls: "cal-holiday", text: holiday.name };
  if (leave) {
    if (leave.status === "pending") return { cls: "cal-pending", text: SHORT_LEAVE_LABELS[leave.leave_type] || "Leave" };
    return { cls: leave.leave_type === "ol" ? "cal-optional" : "cal-approved", text: SHORT_LEAVE_LABELS[leave.leave_type] || "Leave" };
  }
  if (sunday || date >= today) return { cls: "" }; // weekly off / upcoming: blank
  return { cls: "cal-missing", text: "Missing" };
}

// My Attendance → Attendance Calendar: the month at a glance + leave balances.
// Click a day to apply for CL / SL / OL / EL or Comp Off.
export default function AttendanceCalendarPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const calendar = useSelector((state) => state.self.calendar);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [month, setMonth] = useState(() => toMonth(new Date()));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (user.employee_id) dispatch(fetchCalendar(month));
  }, [dispatch, month, user.employee_id]);

  const byDate = useMemo(() => {
    const map = {};
    if (!calendar || calendar.month !== month) return map;
    const entry = (d) => (map[d] ||= { day: null, holiday: null, leaves: [] });
    calendar.days.forEach((d) => { entry(d.date).day = d; });
    calendar.holidays.forEach((h) => { entry(h.date).holiday = h; });
    calendar.leaves.forEach((l) => {
      for (let d = new Date(`${l.from_date}T00:00:00`); isoDate(d) <= l.to_date; d.setDate(d.getDate() + 1)) {
        if (isoDate(d).startsWith(month)) entry(isoDate(d)).leaves.push(l);
      }
    });
    return map;
  }, [calendar, month]);

  if (!user.employee_id) {
    return (
      <div>
        <AttendanceTabs />
        <div className="empty-state">Your login isn't linked to an employee record — please ask HR to link it.</div>
      </div>
    );
  }

  const today = calendar?.today || isoDate(new Date());
  const balances = calendar?.balances;
  const cells = buildCells(month);

  return (
    <div>
      <AttendanceTabs />

      <div className="bg-card border border-line rounded-xl">
        <PageStrip title="HR / Attendance Calendar" />

        <div className="flex flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-4 border-b border-line">
          <div className="flex flex-wrap items-start gap-4">
            <Input id="calEmployee" lable="Employee" value={calendar?.employee?.name || user.name} readOnly respclass="w-64" removeFormGroupClass />
            <DatePicker id="calMonth" name="month" lable="Month" viewDate="month" value={monthDate} handleChange={(e) => setMonthDate(e.target.value)} respclass="w-60" removeFormGroupClass />
            <Button name="Search" className="btn-primary h-8 !py-0 px-6" handleClick={() => monthDate && setMonth(toMonth(monthDate))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-slate mr-1">AVAILABLE</span>
            {BALANCE_TYPES.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full border border-line text-xs font-semibold text-ink" title={`${SHORT_LEAVE_LABELS[t]} available`}>
                {SHORT_LEAVE_LABELS[t]} : <span className="text-primary">{balances ? balances[t].available : "—"}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 p-4">
          {/* Month grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-sm py-2 rounded-md bg-primary/10 text-primary tracking-wide">{w}</div>
              ))}
              {cells.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} className="min-h-[96px] rounded-lg bg-ivory/60" />;
                const info = byDate[date] || { day: null, holiday: null, leaves: [] };
                const sunday = i % 7 === 0;
                const look = dayLook({ date, today, sunday, ...info });
                const d = info.day;
                const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const effective = d ? d.totalMinutes - d.breakMinutes : 0;
                const running = d?.punchIn && !d.punchOut;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelected(date)}
                    className={`min-h-[96px] rounded-lg p-1.5 text-center flex flex-col gap-1 border border-line/60 hover:brightness-105 transition ${look.cls || "bg-card"} ${
                      date === today ? "ring-2 ring-brass" : ""
                    }`}
                    aria-label={`${label}${look.text ? `, ${look.text}` : ""}`}
                  >
                    <span className={`rounded-md py-0.5 text-sm font-semibold ${look.cls ? "bg-white/90 text-[#13221f]" : "bg-primary/10 text-primary"}`}>{label}</span>
                    {look.text && <span className="text-xs font-medium">{look.text}</span>}
                    {d?.punchIn && (
                      <span className="text-2xs leading-5">
                        Time: <b>{time12(d.punchIn)}</b> - <b>{d.punchOut ? time12(d.punchOut) : "--"}</b>
                        {running && <span className="inline-block w-2 h-2 ml-1 rounded-full bg-leaf align-middle" aria-label="in progress" />}
                        <br />
                        Work Hours:{" "}
                        <b className={running ? "text-[#0b6fa4] dark:text-[#7cc8f0]" : d.totalMinutes < REQUIRED_WORK_MIN ? "cal-late" : ""}>{hhmm(d.totalMinutes)}</b>
                        <br />
                        Effective Hours:{" "}
                        <b className={running ? "text-[#0b6fa4] dark:text-[#7cc8f0]" : effective < REQUIRED_EFFECTIVE_MIN ? "cal-late" : ""}>{hhmm(Math.max(0, effective))}</b>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend + note */}
          <aside className="xl:w-80 shrink-0 flex flex-col gap-3">
            <div className="border border-line rounded-xl p-4 flex flex-col gap-2.5">
              {LEGEND.map((l) => (
                <span key={l.cls} className="flex items-center gap-2.5 text-sm text-ink">
                  <span className={`w-4 h-4 rounded ${l.cls}`} />
                  {l.label}
                </span>
              ))}
            </div>
            <div className="rounded-xl border border-gold/40 bg-goldbg px-4 py-3 text-sm">
              <b className="text-rust">Note</b> : <span className="text-rust">Pending SL will carry forward in the next financial year</span>
            </div>
          </aside>
        </div>
      </div>

      {selected && calendar?.rules && (
        <DayModal
          date={selected}
          info={{ ...(byDate[selected] || { day: null, holiday: null, leaves: [] }), isSunday: new Date(`${selected}T00:00:00`).getDay() === 0 }}
          rules={calendar.rules}
          balances={balances}
          onClose={() => setSelected(null)}
          onApplied={() => { setSelected(null); dispatch(fetchCalendar(month)); }}
        />
      )}
    </div>
  );
}
