import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAssignedTasks, fetchAssignable, createTask, reviewTask, deleteTask } from "../../store/slices/tasksSlice";
import TaskCard from "./TaskCard";
import useCan from "../../hooks/useCan";
import { STATUS_META, STATUS_ORDER, displayStatus } from "../../utils/tasks";
import { isoDate } from "../../utils/workday";

function AssignTaskModal({ employees, onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ title: "", description: "", assignedTo: employees[0]?.id || "", priority: "medium", dueDate: "" });
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(createTask(form));
    if (!result.error) onClose();
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="flex justify-between items-center mb-4">
          <h2>Assign a ticket</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Assign to</label>
        <select value={form.assignedTo} onChange={update("assignedTo")} required>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.designation ? ` — ${e.designation}` : ""}</option>)}
        </select>
        <label>Ticket title</label>
        <input value={form.title} onChange={update("title")} required maxLength={200} />
        <label>Description</label>
        <textarea rows={3} value={form.description} onChange={update("description")} />
        <div className="flex gap-3">
          <div className="flex flex-col flex-1">
            <label>Priority</label>
            <select value={form.priority} onChange={update("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex flex-col flex-1">
            <label>Due date</label>
            <input type="date" min={isoDate(new Date())} value={form.dueDate} onChange={update("dueDate")} />
          </div>
        </div>
        <button type="submit" className="btn-primary justify-center mt-5">Assign ticket</button>
      </form>
    </div>
  );
}

// Tickets the user handed out (HR/superadmin: whole company) — assign, approve, reopen.
export default function TeamTickets() {
  const dispatch = useDispatch();
  const can = useCan();
  const { assigned, assignable } = useSelector((state) => state.tasks);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    dispatch(fetchAssignedTasks());
    dispatch(fetchAssignable());
  }, [dispatch]);

  const counts = STATUS_ORDER.reduce((acc, s) => ({ ...acc, [s]: assigned.filter((t) => displayStatus(t) === s).length }), {});
  const visible = filter === "all" ? assigned : assigned.filter((t) => displayStatus(t) === filter);

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <div>
          <h2>Team tickets</h2>
          <p className="text-sm text-slate">
            {can("tasks.assignAnyone") ? "All tickets across the company." : "Tickets you have assigned to your team."} Approve them here once they're marked done.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)} disabled={assignable.length === 0}>
          <Plus size={15} /> Assign ticket
        </button>
      </div>
      {assignable.length === 0 && (
        <div className="text-sm text-rust mb-3">
          No one is in your team yet — on the Employees page, set "Reports to" to you (and make sure your login is linked to your employee record).
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 my-4">
        {[{ key: "all", label: "All", count: assigned.length }, ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label, count: counts[s] }))].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${filter === f.key ? "bg-primary text-primaryfg border-primary" : "bg-card text-slate border-line"}`}
          >
            {f.key !== "all" && <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[f.key].color }} />}
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">No tickets.</div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-3">
          {visible.map((t) => (
            <TaskCard
              key={`${t.id}-${t.updated_at}`}
              task={t}
              mode="assigned"
              onReview={(payload) => dispatch(reviewTask(payload))}
              onDelete={(id) => dispatch(deleteTask(id))}
            />
          ))}
        </div>
      )}

      {showForm && <AssignTaskModal employees={assignable} onClose={() => setShowForm(false)} />}
    </div>
  );
}
