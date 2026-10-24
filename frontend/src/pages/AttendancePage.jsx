import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchAttendanceByDate } from "../store/slices/attendanceSlice";
import AttendanceTable from "../components/attendance/AttendanceTable";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const [date, setDate] = useState(todayISO());
  const dispatch = useDispatch();
  const employees = useSelector((state) => state.employees.list);
  const records = useSelector((state) => state.attendance.byDate[date] || []);

  useEffect(() => { dispatch(fetchEmployees()); }, [dispatch]);
  useEffect(() => { dispatch(fetchAttendanceByDate(date)); }, [dispatch, date]);

  return (
    <div>
      <div className="flex justify-between items-end mb-5">
        <h1>Attendance</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-line rounded-md text-sm"
        />
      </div>
      {employees.length === 0 ? (
        <div className="empty-state">Add employees first from the "Employees" page.</div>
      ) : (
        <AttendanceTable employees={employees} date={date} records={records} />
      )}
    </div>
  );
}
