import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { addCandidate } from "../../store/slices/recruitmentSlice";

export default function CandidateFormModal({ jobs, defaultJobId, onClose }) {
  const [form, setForm] = useState({
    jobPostingId: defaultJobId || jobs[0]?.id || "",
    name: "", email: "", phone: "", resumeUrl: "", notes: "",
  });
  const dispatch = useDispatch();

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await dispatch(addCandidate(form));
    onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>Add candidate</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Job posting</label>
        <select value={form.jobPostingId} onChange={update("jobPostingId")} required>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <label>Candidate name</label>
        <input value={form.name} onChange={update("name")} required />
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update("email")} />
          </div>
          <div className="flex flex-col flex-1">
            <label>Phone</label>
            <input value={form.phone} onChange={update("phone")} />
          </div>
        </div>
        <label>Resume link (optional)</label>
        <input value={form.resumeUrl} onChange={update("resumeUrl")} placeholder="https://..." />
        <label>Notes</label>
        <textarea rows={3} value={form.notes} onChange={update("notes")} />
        <button type="submit" className="btn-primary justify-center mt-5" disabled={jobs.length === 0}>
          Add candidate
        </button>
      </form>
    </div>
  );
}
