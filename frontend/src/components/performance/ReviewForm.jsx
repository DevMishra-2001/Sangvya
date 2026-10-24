import { useState } from "react";
import { X, Pencil, Check } from "lucide-react";
import { useDispatch } from "react-redux";
import { saveReview, updateReviewStatus } from "../../store/slices/performanceSlice";
import StarRating from "./StarRating";

export function ReviewTable({ employees, reviews, cycleId, onEdit }) {
  const dispatch = useDispatch();
  const reviewFor = (empId) => reviews.find((r) => r.employee_id === empId);

  if (employees.length === 0) {
    return <div className="empty-state">Add employees first from the "Employees" page.</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Rating</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp) => {
          const r = reviewFor(emp.id);
          return (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>{r?.rating ? <StarRating value={r.rating} readOnly /> : "—"}</td>
              <td>
                {r ? (
                  <span className={`status-pill status-${r.status === "acknowledged" ? "approved" : r.status === "submitted" ? "pending" : "unset"}`}>
                    {r.status}
                  </span>
                ) : (
                  <span className="status-pill status-unset">not started</span>
                )}
              </td>
              <td className="flex gap-2 items-center">
                <button onClick={() => onEdit(emp, r)} className="p-1 text-slate hover:text-ink">
                  <Pencil size={14} />
                </button>
                {r && r.status === "submitted" && (
                  <button
                    onClick={() => dispatch(updateReviewStatus({ id: r.id, status: "acknowledged" }))}
                    className="flex items-center gap-1 text-xs text-leaf"
                    title="Mark acknowledged"
                  >
                    <Check size={13} /> Acknowledge
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ReviewFormModal({ employee, cycleId, existing, onClose }) {
  const [form, setForm] = useState({
    rating: existing?.rating || 0,
    strengths: existing?.strengths || "",
    improvements: existing?.improvements || "",
    goalsNextCycle: existing?.goals_next_cycle || "",
    managerComments: existing?.manager_comments || "",
  });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSave(status) {
    await dispatch(saveReview({
      cycleId, employeeId: employee.id, ...form, status,
    }));
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal w-[480px]">
        <div className="flex justify-between items-center mb-4">
          <h2>Review — {employee.name}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <label>Overall rating</label>
        <StarRating value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />

        <label>Strengths</label>
        <textarea rows={2} value={form.strengths} onChange={update("strengths")} />

        <label>Areas for improvement</label>
        <textarea rows={2} value={form.improvements} onChange={update("improvements")} />

        <label>Goals for next cycle</label>
        <textarea rows={2} value={form.goalsNextCycle} onChange={update("goalsNextCycle")} />

        <label>Manager comments</label>
        <textarea rows={2} value={form.managerComments} onChange={update("managerComments")} />

        <div className="flex gap-2 mt-5">
          <button type="button" className="btn-primary flex-1 justify-center bg-transparent border border-line !text-ink" onClick={() => handleSave("draft")}>
            Save draft
          </button>
          <button type="button" className="btn-primary flex-1 justify-center" onClick={() => handleSave("submitted")}>
            Submit review
          </button>
        </div>
      </div>
    </div>
  );
}
