import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchLeaves } from "../store/slices/leaveSlice";
import { fetchAttendanceByDate } from "../store/slices/attendanceSlice";
import useCan from "../hooks/useCan";
import PunchCard from "../components/attendance/PunchCard";
import BirthdayPanel from "../components/dashboard/BirthdayPanel";
import AnnouncementsPanel from "../components/dashboard/AnnouncementsPanel";
import ProgressGraph from "../components/dashboard/ProgressGraph";
import { isoDate } from "../utils/workday";

const todayISO = () => isoDate(new Date()); // local date, not UTC

export default function DashboardPage() {
  const dispatch = useDispatch();
  const can = useCan();
  const showEmployees = can("employees.view");
  const showAttendance = can("attendance.view");
  const viewAllLeaves = can("leave.viewAll");
  const user = useSelector((state) => state.auth.user);
  const showPunch = can("attendance.self") && Boolean(user.employee_id);
  const today = todayISO();
  const employees = useSelector((state) => state.employees.list);
  const leaves = useSelector((state) => state.leave.list);
  const todayAttendance = useSelector((state) => state.attendance.byDate[today] || []);

  useEffect(() => {
    if (showEmployees) dispatch(fetchEmployees());
    if (viewAllLeaves) dispatch(fetchLeaves());
    if (showAttendance) dispatch(fetchAttendanceByDate(today));
  }, [dispatch, today, showEmployees, showAttendance, viewAllLeaves]);

  const presentCount = todayAttendance.filter((r) => r.status === "present").length;
  const pendingLeaves = leaves.filter((l) => l.status === "pending").length;

  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      {/* Top row: progress (left) · announcements (middle) · birthday wishes (right) */}
      <div className="flex flex-wrap items-stretch justify-between gap-4 mb-6">
        {user.employee_id ? <ProgressGraph /> : <span />}
        <AnnouncementsPanel />
        <BirthdayPanel />
      </div>
      {showPunch && <PunchCard />}
      {(showEmployees || showAttendance || viewAllLeaves) && (
      <div className="flex gap-4 mb-7">
        {showEmployees && (
          <div className="bg-card border border-line rounded-lg px-5 py-4.5 flex-1">
            <div className="text-xs text-slate mb-2">Total Employees</div>
            <div className="font-serif text-3xl">{employees.length}</div>
          </div>
        )}
        {showAttendance && (
          <div className="bg-card border border-line rounded-lg px-5 py-4.5 flex-1">
            <div className="text-xs text-slate mb-2">Present Today</div>
            <div className="font-serif text-3xl">{presentCount}</div>
          </div>
        )}
        {viewAllLeaves && (
          <div className="bg-card border border-line rounded-lg px-5 py-4.5 flex-1">
            <div className="text-xs text-slate mb-2">Pending Leave Requests</div>
            <div className="font-serif text-3xl">{pendingLeaves}</div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
