import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAttendanceDay, fetchToday, punchAction } from "../../store/slices/selfSlice";
import AttendanceTabs, { PageStrip } from "../../components/attendance/AttendanceTabs";
import { DataTable } from "../../components/Table";
import { Input, ReactSelect, DatePicker, Button } from "../../components/formComponent";
import { ATTENDANCE_FLAGS, FLAG_META, LOCATION_LABELS, LOCATION_OPTIONS } from "../../utils/attendanceMeta";
import { SHORT_LEAVE_LABELS, fmtTime, fmtMinutes, isoDate } from "../../utils/workday";

const nowLabel = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase();

// My Attendance → Attendance: one day of the employee's own attendance, with
// check-in / check-out (time is always "now") and break start/end.
export default function AttendanceTodayPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const data = useSelector((state) => state.self.attendanceDay);
  const busy = useSelector((state) => state.self.busy);
  const [date, setDate] = useState(() => new Date());
  const [form, setForm] = useState({ location: "office", remarks: "" });
  const [clock, setClock] = useState(nowLabel);

  const load = (d = date) => dispatch(fetchAttendanceDay(isoDate(d)));

  useEffect(() => {
    if (user.employee_id) load(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employee_id]);

  // Live clock for the check-in/out time box
  useEffect(() => {
    const t = setInterval(() => setClock(nowLabel()), 15000);
    return () => clearInterval(t);
  }, []);

  if (!user.employee_id) {
    return (
      <div>
        <AttendanceTabs />
        <div className="empty-state">Your login isn't linked to an employee record — please ask HR to link it.</div>
      </div>
    );
  }

  const day = data?.day;
  const isToday = data && data.date === data.today;
  const checkedIn = Boolean(day?.punchIn);
  const checkedOut = Boolean(day?.punchOut);
  const working = checkedIn && !checkedOut; // punched out = on a break (or done for the day)
  const canPunch = isToday;

  async function act(action, details) {
    const result = await dispatch(punchAction({ action, ...details }));
    if (!result.error) {
      setForm((f) => ({ ...f, remarks: "" }));
      load();
      dispatch(fetchToday()); // header timer + dashboard punch card
    }
  }

  const leave = data?.leaves?.find((l) => l.status !== "rejected");
  const statusMeta = FLAG_META[data?.status];

  // One row per work session (punch in → punch out), each with its own location +
  // remarks; the gap until the next session is that session's break.
  const sessions = day?.sessions?.length ? day.sessions : [null];
  const leaveText = leave ? `${SHORT_LEAVE_LABELS[leave.leave_type] || "Leave"} (${leave.status})` : data?.holiday ? data.holiday.name : "";
  const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  const rows = data
    ? sessions.map((s, i) => {
        const next = sessions[i + 1];
        return {
          id: `${data.date}-${i}`,
          name: data.employee.name,
          login: s?.in ? fmtTime(s.in) : "",
          loginLocation: LOCATION_LABELS[s?.inLocation] || "",
          logout: s?.out ? fmtTime(s.out) : "",
          logoutLocation: LOCATION_LABELS[s?.outLocation] || "",
          remarks: [s?.inRemarks, s?.outRemarks].filter(Boolean).join(" · "),
          leave: i === 0 ? leaveText : "",
          last: i === sessions.length - 1,
          breakAfter: s?.out && next?.in ? fmtMinutes(minutesBetween(s.out, next.in)) : "",
        };
      })
    : [];

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (r, i) => (
        <span className="flex items-center gap-2.5">
          <span className="tabular-nums text-slate">{String(i + 1).padStart(2, "0")}</span>
          <span className="w-7 h-7 rounded-full bg-primary text-primaryfg flex items-center justify-center text-xs font-bold">
            {r.name?.[0]?.toUpperCase()}
          </span>
          <span className="font-semibold">{r.name}</span>
        </span>
      ),
    },
    { key: "login", label: "Login", className: "tabular-nums" },
    { key: "loginLocation", label: "Location" },
    { key: "logout", label: "Logout", className: "tabular-nums" },
    { key: "logoutLocation", label: "Location" },
    { key: "remarks", label: "Remarks" },
    { key: "leave", label: "Leave" },
    {
      key: "status",
      label: "Status",
      // The day's status sits on the latest session; earlier ones are finished
      render: (r) =>
        !r.last ? <span className="text-slate">Completed</span>
        : statusMeta ? <span className="font-semibold" style={{ color: statusMeta.color }}>{statusMeta.label}</span> : "—",
    },
    {
      key: "breakAfter",
      label: "Break",
      className: "tabular-nums",
      render: (r) => r.breakAfter || "—",
    },
  ];

  return (
    <div>
      <AttendanceTabs />

      <div className="bg-card border border-line rounded-xl mb-4">
        <PageStrip title="Attendance">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink">
            {ATTENDANCE_FLAGS.map((f) => (
              <span key={f.key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                {f.label} : {data?.flags?.includes(f.key) ? 1 : 0}
              </span>
            ))}
            <span>Total Record : {rows.length}</span>
          </div>
        </PageStrip>
        <div className="flex flex-wrap items-start gap-4 px-4 pt-5 pb-4">
          <DatePicker id="attDate" name="date" lable="Date" value={date} handleChange={(e) => setDate(e.target.value)} maxDate={new Date()} respclass="w-60" removeFormGroupClass />
          <Input id="attEmployee" lable="Employee" value={data?.employee?.name || user.name} readOnly respclass="w-72" removeFormGroupClass />
          <Button name="Search" className="btn-primary h-8 !py-0" handleClick={() => load()} />
        </div>
      </div>

      <DataTable columns={columns} rows={rows} rowKey="id" showSummary={false} emptyText="No attendance for this day." />

      {canPunch && (
        <div className="bg-card border border-line rounded-xl mt-4 px-4 pt-5 pb-4 flex flex-wrap items-start gap-4">
          <ReactSelect
            id="punchLocation"
            name="location"
            placeholderName="Location"
            dynamicOptions={LOCATION_OPTIONS}
            value={form.location}
            handleChange={(_, option) => setForm({ ...form, location: option?.value || "" })}
            removeIsClearable
            respclass="w-60"
          />
          <Input
            id="punchRemarks"
            name="remarks"
            lable="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            maxLength={300}
            respclass="w-72"
            removeFormGroupClass
          />
          <Input id="punchTime" lable="Time" value={clock} readOnly respclass="w-32" removeFormGroupClass />
          <Button
            name={busy ? "Please wait…" : working ? "Check Out" : "Check In"}
            className={`btn-primary h-8 !py-0 ${working ? "!bg-rust" : ""}`}
            disabled={busy || !form.location}
            handleClick={() => act(working ? "punch-out" : "punch-in", { location: form.location, remarks: form.remarks })}
          />
        </div>
      )}
    </div>
  );
}
