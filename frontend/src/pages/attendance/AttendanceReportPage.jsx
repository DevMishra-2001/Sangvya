import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCalendar, fetchMyLeaves } from "../../store/slices/selfSlice";
import AttendanceTabs, { PageStrip } from "../../components/attendance/AttendanceTabs";
import { DataTable } from "../../components/Table";
import { Input, DatePicker, ReactSelect, Button } from "../../components/formComponent";
import { SHORT_LEAVE_LABELS, LEAVE_TYPE_LABELS, BALANCE_TYPES, fmtTime, fmtMinutes, isoDate } from "../../utils/workday";
import { toMonth, monthLabel } from "../../utils/attendanceMeta";

const SEARCH_TYPES = [
  { value: "attendance", label: "Attendance Report" },
  { value: "leave", label: "Leave Report" },
];

function daysOf(month) {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => isoDate(new Date(y, m - 1, i + 1)));
}

const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// What a day's row says in the Status column (+ pill style)
function dayStatus({ date, today, day, holiday, leave, sunday }) {
  if (day?.punchIn) {
    if (!day.punchOut) return { label: date === today ? "In progress" : "No check-out", cls: "status-pending" };
    if (day.shortDay) return { label: "Short day", cls: "status-absent" };
    if (day.longBreak) return { label: "Long break", cls: "status-half" };
    return { label: "Present", cls: "status-present" };
  }
  if (leave) return { label: `${SHORT_LEAVE_LABELS[leave.leave_type] || "Leave"} · ${leave.status}`, cls: `status-${leave.status}` };
  if (holiday) return { label: holiday.name, cls: "status-unset" };
  if (sunday) return { label: "Weekly off", cls: "status-unset" };
  if (date > today) return { label: "—", cls: "" };
  if (day?.status === "present") return { label: "Present", cls: "status-present" };
  if (day?.status === "half") return { label: "Half day", cls: "status-half" };
  return { label: "Absent", cls: "status-absent" };
}

function SummaryCards({ items }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
      {items.map((s) => (
        <div key={s.label} className="bg-card border border-line rounded-xl px-4 py-3">
          <div className="text-xs text-slate">{s.label}</div>
          <div className={`font-serif text-2xl ${s.warn && s.value ? "text-rust" : "text-ink"}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function AttendanceReport({ calendar, month }) {
  const rows = useMemo(() => {
    if (!calendar || calendar.month !== month) return [];
    const byDay = Object.fromEntries(calendar.days.map((d) => [d.date, d]));
    const holidays = Object.fromEntries(calendar.holidays.map((h) => [h.date, h]));
    return daysOf(month).map((date) => {
      const leave = calendar.leaves.find((l) => l.status !== "rejected" && l.from_date <= date && l.to_date >= date);
      const sunday = new Date(`${date}T00:00:00`).getDay() === 0;
      const info = { date, today: calendar.today, day: byDay[date], holiday: holidays[date], leave, sunday };
      return { ...info, status: dayStatus(info) };
    });
  }, [calendar, month]);

  const worked = rows.filter((r) => r.day?.punchOut);
  const summary = [
    { label: "Present", value: worked.length },
    { label: "Short days", value: worked.filter((r) => r.day.shortDay).length, warn: true },
    { label: "Absent", value: rows.filter((r) => r.status.label === "Absent").length, warn: true },
    { label: "Leaves", value: rows.filter((r) => r.leave && !r.day?.punchIn).length },
    { label: "Total hours", value: fmtMinutes(worked.reduce((s, r) => s + r.day.totalMinutes, 0)) },
  ];

  const columns = [
    { key: "date", label: "Date", sortable: true, className: "tabular-nums", render: (r) => fmtDay(r.date) },
    { key: "day", label: "Day", render: (r) => new Date(`${r.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }) },
    { key: "in", label: "Login", className: "tabular-nums", render: (r) => (r.day?.punchIn ? fmtTime(r.day.punchIn) : "—") },
    { key: "out", label: "Logout", className: "tabular-nums", render: (r) => (r.day?.punchOut ? fmtTime(r.day.punchOut) : "—") },
    { key: "break", label: "Break", className: "tabular-nums", render: (r) => (r.day?.punchIn ? <span className={r.day.longBreak ? "text-rust" : ""}>{fmtMinutes(r.day.breakMinutes)}</span> : "—") },
    { key: "work", label: "Work Hours", className: "tabular-nums", render: (r) => (r.day?.punchOut ? <span className={r.day.shortDay ? "text-rust font-medium" : "font-medium"}>{fmtMinutes(r.day.totalMinutes)}</span> : "—") },
    { key: "effective", label: "Effective Hours", className: "tabular-nums", render: (r) => (r.day?.punchOut ? fmtMinutes(Math.max(0, r.day.totalMinutes - r.day.breakMinutes)) : "—") },
    { key: "status", label: "Status", render: (r) => (r.status.cls ? <span className={`status-pill ${r.status.cls}`}>{r.status.label}</span> : <span className="text-slate">{r.status.label}</span>) },
  ];

  return (
    <>
      <SummaryCards items={summary} />
      <DataTable title={`Attendance Report — ${monthLabel(month)}`} columns={columns} rows={rows} rowKey="date" pageSize={31} />
    </>
  );
}

function LeaveReport({ leaves, balances, month }) {
  const list = leaves?.month === month ? leaves.leaves : [];
  const summary = BALANCE_TYPES.map((t) => ({
    label: `${SHORT_LEAVE_LABELS[t]} available`,
    value: balances ? `${balances[t].available} / ${balances[t].quota}` : "—",
  }));
  summary.push({ label: "Leave days this month", value: list.filter((l) => l.status !== "rejected").reduce((s, l) => s + l.days, 0) });

  const columns = [
    { key: "sno", label: "S.No.", render: (_, i) => i + 1 },
    { key: "leave_type", label: "Leave Type", sortable: true, render: (r) => LEAVE_TYPE_LABELS[r.leave_type] || "Leave" },
    { key: "from_date", label: "From", sortable: true, className: "tabular-nums", render: (r) => fmtDay(r.from_date) },
    { key: "to_date", label: "To", className: "tabular-nums", render: (r) => fmtDay(r.to_date) },
    { key: "days", label: "Days", sortable: true, className: "tabular-nums" },
    { key: "reason", label: "Description", render: (r) => r.reason || "—" },
    { key: "status", label: "Status", sortable: true, render: (r) => <span className={`status-pill status-${r.status}`}>{r.status}</span> },
    { key: "reviewed_by_name", label: "Approved / Rejected By", render: (r) => r.reviewed_by_name || "—" },
  ];

  return (
    <>
      <SummaryCards items={summary} />
      <DataTable title={`Leave Report — ${monthLabel(month)}`} columns={columns} rows={list} rowKey="id" emptyText="No leaves this month." />
    </>
  );
}

// My Attendance → Attendance Report: month-wise attendance or leave report.
export default function AttendanceReportPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { calendar, leaves, balances } = useSelector((state) => state.self);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [searchType, setSearchType] = useState("attendance");
  const [shown, setShown] = useState(null); // { type, month } after Search

  function search() {
    if (!monthDate) return;
    const month = toMonth(monthDate);
    dispatch(fetchCalendar(month)); // attendance rows + leave balances
    if (searchType === "leave") dispatch(fetchMyLeaves(month));
    setShown({ type: searchType, month });
  }

  useEffect(() => {
    if (user.employee_id) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employee_id]);

  if (!user.employee_id) {
    return (
      <div>
        <AttendanceTabs />
        <div className="empty-state">Your login isn't linked to an employee record — please ask HR to link it.</div>
      </div>
    );
  }

  return (
    <div>
      <AttendanceTabs />

      <div className="bg-card border border-line rounded-xl mb-4">
        <PageStrip title="HR / Attendance Report" />
        <div className="flex flex-wrap items-start gap-4 px-4 pt-5 pb-4">
          <DatePicker id="repMonth" name="month" lable="Month" viewDate="month" value={monthDate} handleChange={(e) => setMonthDate(e.target.value)} respclass="w-60" removeFormGroupClass />
          <Input id="repEmployee" lable="Employee" value={calendar?.employee?.name || user.name} readOnly respclass="w-72" removeFormGroupClass />
          <ReactSelect
            id="repType"
            name="searchType"
            placeholderName="SearchType"
            dynamicOptions={SEARCH_TYPES}
            value={searchType}
            handleChange={(_, option) => setSearchType(option?.value || "attendance")}
            removeIsClearable
            respclass="w-72"
          />
          <Button name="Search" className="btn-primary h-8 !py-0" handleClick={search} />
        </div>
      </div>

      {shown?.type === "attendance" && <AttendanceReport calendar={calendar} month={shown.month} />}
      {shown?.type === "leave" && <LeaveReport leaves={leaves} balances={balances} month={shown.month} />}
    </div>
  );
}
