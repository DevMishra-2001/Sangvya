import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyTasks, updateTaskProgress } from "../../store/slices/tasksSlice";
import TaskCard from "./TaskCard";
import TaskCharts from "./TaskCharts";
import { STATUS_META, STATUS_ORDER, displayStatus } from "../../utils/tasks";

const FILTERS = [{ key: "all", label: "All" }, ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label }))];

// Tickets assigned to the logged-in user: progress charts + cards they update.
export default function MyTickets() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { mine, stats } = useSelector((state) => state.tasks);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (user.employee_id) dispatch(fetchMyTasks());
  }, [dispatch, user.employee_id]);

  if (!user.employee_id) {
    return <div className="empty-state">Your login isn't linked to an employee record — please ask HR to link it.</div>;
  }

  async function handleProgress(payload) {
    const result = await dispatch(updateTaskProgress(payload));
    if (!result.error) dispatch(fetchMyTasks()); // refresh chart stats
  }

  const visible = filter === "all" ? mine : mine.filter((t) => displayStatus(t) === filter);

  return (
    <div>
      <h2 className="mb-3">My progress</h2>
      <TaskCharts stats={stats} />

      <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-3">
        <h2>My tickets</h2>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? mine.length : stats?.counts?.[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                  filter === f.key ? "bg-primary text-primaryfg border-primary" : "bg-card text-slate border-line"
                }`}
              >
                {f.key !== "all" && <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[f.key].color }} />}
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="empty-state">{mine.length === 0 ? "No tickets have been assigned to you yet." : "No tickets match this filter."}</div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-3">
          {visible.map((t) => <TaskCard key={`${t.id}-${t.updated_at}`} task={t} mode="mine" onProgress={handleProgress} />)}
        </div>
      )}
    </div>
  );
}
