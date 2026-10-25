"use client";

import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { EmptyState, NotLinkedState } from "@/components/common/empty-state";
import { displayStatus } from "@/lib/constants";
import { useUser } from "@/stores/auth-store";
import { useTasksStore } from "@/stores/tasks-store";
import { StatusFilter, type TicketFilter } from "./status-filter";
import { TaskCard } from "./task-card";
import { TaskCharts } from "./task-charts";

// Tickets assigned to me: progress charts + cards I update
export function MyTickets() {
  const user = useUser();
  const mine = useTasksStore((s) => s.mine);
  const stats = useTasksStore((s) => s.stats);
  const loadMine = useTasksStore((s) => s.loadMine);
  const progress = useTasksStore((s) => s.progress);
  const [filter, setFilter] = useState<TicketFilter>("all");

  useEffect(() => {
    if (user.employee_id) loadMine();
  }, [user.employee_id, loadMine]);

  if (!user.employee_id) return <NotLinkedState />;

  const visible = filter === "all" ? mine : mine.filter((t) => displayStatus(t) === filter);

  return (
    <div className="flex flex-col gap-6">
      <TaskCharts stats={stats} />
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">My tickets</h2>
          {stats && <StatusFilter value={filter} onChange={setFilter} counts={stats.counts} total={mine.length} />}
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={Ticket} title={mine.length === 0 ? "No tickets assigned to you yet" : "No tickets match this filter"} />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visible.map((t) => (
              <TaskCard key={`${t.id}-${t.updated_at}`} task={t} mode="mine" onProgress={(status, p) => progress(t.id, status, p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
