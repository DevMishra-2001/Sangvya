import { Pencil, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { deleteEmployee } from "../../store/slices/employeesSlice";

export default function EmployeeList({ employees, canManage, onEdit }) {
  const dispatch = useDispatch();

  if (employees.length === 0) {
    return <div className="empty-state">No employees yet. Click "Add employee" to get started.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Designation</th>
          <th>Department</th>
          <th>Reports to</th>
          <th>Joined</th>
          <th>Salary</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => (
          <tr key={emp.id}>
            <td>{emp.name}</td>
            <td>{emp.designation || "—"}</td>
            <td>{emp.department || "—"}</td>
            <td>{employees.find((m) => m.id === emp.manager_id)?.name || "—"}</td>
            <td>{emp.join_date?.slice(0, 10) || "—"}</td>
            <td>{emp.salary ? `₹${Number(emp.salary).toLocaleString("en-IN")}` : "—"}</td>
            <td className="flex gap-1.5">{canManage && (<>
              <button onClick={() => onEdit(emp)} className="p-1 text-slate hover:text-ink"><Pencil size={14} /></button>
              <button onClick={() => dispatch(deleteEmployee(emp.id))} className="p-1 text-slate hover:text-rust"><Trash2 size={14} /></button>
            </>)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
