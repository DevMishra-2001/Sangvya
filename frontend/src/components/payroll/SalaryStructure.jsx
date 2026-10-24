import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { setSalaryStructure } from "../../store/slices/payrollSlice";

export function SalaryStructureTable({ employees, structures, onEdit }) {
  const structureFor = (empId) => structures.find((s) => s.employee_id === empId);

  if (employees.length === 0) {
    return <div className="empty-state">Add employees first from the "Employees" page.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Basic</th>
          <th>HRA</th>
          <th>Allowances</th>
          <th>Gross</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => {
          const s = structureFor(emp.id);
          const gross = s ? Number(s.basic) + Number(s.hra) + Number(s.allowances) : null;
          return (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{s ? `₹${Number(s.basic).toLocaleString("en-IN")}` : "—"}</td>
              <td>{s ? `₹${Number(s.hra).toLocaleString("en-IN")}` : "—"}</td>
              <td>{s ? `₹${Number(s.allowances).toLocaleString("en-IN")}` : "—"}</td>
              <td>{gross !== null ? `₹${gross.toLocaleString("en-IN")}` : "—"}</td>
              <td>
                <button onClick={() => onEdit(emp)} className="p-1 text-slate hover:text-ink">
                  {s ? <Pencil size={14} /> : <Plus size={14} />}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function SalaryStructureFormModal({ employee, structure, onClose }) {
  const [form, setForm] = useState({
    basic: structure?.basic || "",
    hra: structure?.hra || "",
    allowances: structure?.allowances || "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await dispatch(setSalaryStructure({ employeeId: employee.id, ...form }));
    onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>Salary structure — {employee.name}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Basic (₹/month)</label>
        <input type="number" value={form.basic} onChange={update("basic")} required min="0" />
        <label>HRA (₹/month)</label>
        <input type="number" value={form.hra} onChange={update("hra")} min="0" />
        <label>Other allowances (₹/month)</label>
        <input type="number" value={form.allowances} onChange={update("allowances")} min="0" />
        <label>Effective from</label>
        <input type="date" value={form.effectiveFrom} onChange={update("effectiveFrom")} />
        <button type="submit" className="btn-primary justify-center mt-5">Save structure</button>
      </form>
    </div>
  );
}
