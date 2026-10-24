import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { addEmployee, editEmployee } from "../../store/slices/employeesSlice";

// DB rows are snake_case; the form/API use camelCase.
function toForm(emp) {
  if (!emp) return { name: "", designation: "", department: "", email: "", joinDate: "", salary: "", managerId: "", dateOfBirth: "", olQuota: "", employeeCode: "" };
  return {
    name: emp.name || "",
    designation: emp.designation || "",
    department: emp.department || "",
    email: emp.email || "",
    joinDate: emp.join_date?.slice(0, 10) || "",
    salary: emp.salary ?? "",
    managerId: emp.manager_id || "",
    dateOfBirth: emp.date_of_birth?.slice(0, 10) || "",
    olQuota: emp.ol_quota ?? "",
    employeeCode: emp.employee_code || "",
  };
}

export default function EmployeeFormModal({ initial, onClose }) {
  const [form, setForm] = useState(() => toForm(initial));
  const employees = useSelector((state) => state.employees.list);
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, joinDate: form.joinDate || null, dateOfBirth: form.dateOfBirth || null, salary: form.salary === "" ? null : form.salary, managerId: form.managerId || null, olQuota: form.olQuota === "" ? null : Number(form.olQuota) };
    const result = initial
      ? await dispatch(editEmployee({ id: initial.id, ...payload }))
      : await dispatch(addEmployee(payload));
    if (!result.error) onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>{initial ? "Edit employee" : "Add employee"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Full name</label>
        <input value={form.name} onChange={update("name")} required />
        <label>Employee code</label>
        <input value={form.employeeCode} onChange={update("employeeCode")} maxLength={40} placeholder="e.g. IISPL25888" />
        <label>Designation</label>
        <input value={form.designation} onChange={update("designation")} />
        <label>Department</label>
        <input value={form.department} onChange={update("department")} />
        <div className="flex gap-3">
          <div className="flex flex-col flex-[3]">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update("email")} />
          </div>
          <div className="flex flex-col flex-[2]">
            <label>Date of birth</label>
            <input type="date" value={form.dateOfBirth} onChange={update("dateOfBirth")} />
            <label>Optional leaves (OL) per year</label>
            <input type="number" min={0} max={365} step={0.5} value={form.olQuota} onChange={update("olQuota")} placeholder="Company default" />
          </div>
        </div>
        <label>Reports to (manager)</label>
        <select value={form.managerId} onChange={update("managerId")}>
          <option value="">— None —</option>
          {employees.filter((e) => e.id !== initial?.id).map((e) => (
            <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ""}</option>
          ))}
        </select>
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>Join date</label>
            <input type="date" value={form.joinDate} onChange={update("joinDate")} />
          </div>
          <div className="flex flex-col flex-1">
            <label>Monthly salary (₹)</label>
            <input type="number" value={form.salary} onChange={update("salary")} />
          </div>
        </div>
        <button type="submit" className="btn-primary justify-center mt-5">
          {initial ? "Save changes" : "Add employee"}
        </button>
      </form>
    </div>
  );
}
