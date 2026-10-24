import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { requestLeave } from "../../store/slices/leaveSlice";
import { LEAVE_TYPE_LABELS } from "../../utils/workday";

// employees: list to pick from (HR/superadmin applying for anyone), or null to apply for yourself.
export default function LeaveRequestForm({ employees, defaultEmployeeId, onClose }) {
  const [form, setForm] = useState({
    employeeId: employees ? defaultEmployeeId || employees[0]?.id || "" : "",
    leaveType: "leave", fromDate: "", toDate: "", reason: "",
  });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(requestLeave(form));
    if (!result.error) onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>New leave request</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        {employees && (
          <>
            <label>Employee</label>
            <select value={form.employeeId} onChange={update("employeeId")}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </>
        )}
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>From</label>
            <input type="date" value={form.fromDate} onChange={update("fromDate")} required />
          </div>
          <div className="flex flex-col flex-1">
            <label>To</label>
            <input type="date" value={form.toDate} onChange={update("toDate")} required />
          </div>
        </div>
        <label>Type</label>
        <select value={form.leaveType} onChange={update("leaveType")}>
          {["leave", "cl", "sl"].map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
        </select>
        <p className="text-2xs text-slate mt-1">To apply for Comp Off, click that Sunday/holiday on the "My Attendance" calendar.</p>
        <label>Reason</label>
        <textarea rows={3} value={form.reason} onChange={update("reason")} />
        <button type="submit" className="btn-primary justify-center mt-5">Submit request</button>
      </form>
    </div>
  );
}
