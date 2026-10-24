import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { addJob, setJobStatus, deleteJob } from "../../store/slices/recruitmentSlice";
import useCan from "../../hooks/useCan";

export function JobList({ jobs, onSelect, selectedJobId }) {
  const dispatch = useDispatch();
  const canManage = useCan()("recruitment.manage");

  if (jobs.length === 0) {
    return <div className="empty-state">No job postings yet. Click "New job" to get started.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {jobs.map((job) => (
        <div
          key={job.id}
          onClick={() => onSelect(job.id)}
          className={`bg-card border rounded-lg px-4.5 py-3.5 flex justify-between items-center cursor-pointer ${
            selectedJobId === job.id ? "border-brass" : "border-line"
          }`}
        >
          <div>
            <div className="text-sm font-medium">{job.title}</div>
            <div className="text-xs text-slate mt-0.5">
              {job.department || "—"} {job.location && `· ${job.location}`} · {job.candidate_count} candidate{job.candidate_count === "1" ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${job.status === "open" ? "status-approved" : "status-rejected"}`}>{job.status}</span>
            {canManage && (<>
            <select
              value={job.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => dispatch(setJobStatus({ id: job.id, status: e.target.value }))}
              className="text-xs border border-line rounded-md px-2 py-1"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={(e) => { e.stopPropagation(); dispatch(deleteJob(job.id)); }}
              className="p-1 text-slate hover:text-rust"
            >
              <Trash2 size={14} />
            </button>
            </>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobFormModal({ onClose }) {
  const [form, setForm] = useState({ title: "", department: "", location: "", description: "" });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await dispatch(addJob(form));
    onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>New job posting</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Job title</label>
        <input value={form.title} onChange={update("title")} required />
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>Department</label>
            <input value={form.department} onChange={update("department")} />
          </div>
          <div className="flex flex-col flex-1">
            <label>Location</label>
            <input value={form.location} onChange={update("location")} />
          </div>
        </div>
        <label>Description</label>
        <textarea rows={4} value={form.description} onChange={update("description")} />
        <button type="submit" className="btn-primary justify-center mt-5">Post job</button>
      </form>
    </div>
  );
}
