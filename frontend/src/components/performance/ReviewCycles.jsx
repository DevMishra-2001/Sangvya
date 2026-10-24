import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { addCycle, setCycleStatus } from "../../store/slices/performanceSlice";
import useCan from "../../hooks/useCan";

export function CycleList({ cycles, onSelect, selectedCycleId }) {
  const dispatch = useDispatch();
  const canManage = useCan()("performance.manageCycles");

  if (cycles.length === 0) {
    return <div className="empty-state">No review cycles yet. Click "New cycle" to get started.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {cycles.map((cycle) => (
        <div
          key={cycle.id}
          onClick={() => onSelect(cycle.id)}
          className={`bg-card border rounded-lg px-4.5 py-3.5 flex justify-between items-center cursor-pointer ${
            selectedCycleId === cycle.id ? "border-brass" : "border-line"
          }`}
        >
          <div>
            <div className="text-sm font-medium">{cycle.name}</div>
            <div className="text-xs text-slate mt-0.5">
              {cycle.start_date?.slice(0, 10)} → {cycle.end_date?.slice(0, 10)} · {cycle.review_count} review{cycle.review_count === "1" ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${cycle.status === "active" ? "status-approved" : "status-rejected"}`}>{cycle.status}</span>
            {canManage && <select
              value={cycle.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => dispatch(setCycleStatus({ id: cycle.id, status: e.target.value }))}
              className="text-xs border border-line rounded-md px-2 py-1"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CycleFormModal({ onClose }) {
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await dispatch(addCycle(form));
    onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>New review cycle</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Cycle name</label>
        <input value={form.name} onChange={update("name")} placeholder="e.g. Q3 2026" required />
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>Start date</label>
            <input type="date" value={form.startDate} onChange={update("startDate")} required />
          </div>
          <div className="flex flex-col flex-1">
            <label>End date</label>
            <input type="date" value={form.endDate} onChange={update("endDate")} required />
          </div>
        </div>
        <button type="submit" className="btn-primary justify-center mt-5">Create cycle</button>
      </form>
    </div>
  );
}
