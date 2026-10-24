import { useDispatch } from "react-redux";
import { markAttendance } from "../../store/slices/attendanceSlice";

const STATUS_OPTIONS = [
  { value: "present", label: "Present", classes: "border-leaf text-leaf" },
  { value: "half", label: "Half Day", classes: "border-gold text-gold" },
  { value: "absent", label: "Absent", classes: "border-rust text-rust" },
];

export default function AttendanceTable({ employees, date, records }) {
  const dispatch = useDispatch();
  const statusFor = (empId) => records.find((r) => r.employee_id === empId)?.status || "unset";

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Mark</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => (
          <tr key={emp.id}>
            <td>{emp.name}</td>
            <td>
              <span className={`status-pill status-${statusFor(emp.id)}`}>{statusFor(emp.id)}</span>
            </td>
            <td>
              <div className="flex gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`text-xs px-2.5 py-1.5 rounded-md bg-transparent border cursor-pointer ${opt.classes}`}
                    onClick={() => dispatch(markAttendance({ employeeId: emp.id, date, status: opt.value }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
