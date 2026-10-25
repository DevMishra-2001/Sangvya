"use client";

import { useEffect, useState } from "react";
import { Plus, Ticket } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { STATUS_ORDER, displayStatus, type TicketStatus } from "@/lib/constants";
import { useCan } from "@/stores/auth-store";
import { useTasksStore } from "@/stores/tasks-store";
import { AssignTicketDialog } from "./assign-ticket-dialog";
import { StatusFilter, type TicketFilter } from "./status-filter";
import { TaskCard } from "./task-card";

// Tickets I handed out (HR/superadmin: the whole company) — assign, approve, reopen
export function TeamTickets() {
  const can = useCan();
  const assigned = useTasksStore((s) => s.assigned);
  const assignable = useTasksStore((s) => s.assignable);
  const loadAssigned = useTasksStore((s) => s.loadAssigned);
  const loadAssignable = useTasksStore((s) => s.loadAssignable);
  const review = useTasksStore((s) => s.review);
  const remove = useTasksStore((s) => s.remove);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<TicketFilter>("all");

  useEffect(() => {
    loadAssigned();
    loadAssignable();
  }, [loadAssigned, loadAssignable]);

  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, assigned.filter((t) => displayStatus(t) === s).length])) as Record<TicketStatus, number>;
  const visible = filter === "all" ? assigned : assigned.filter((t) => displayStatus(t) === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {can("tasks.assignAnyone") ? "All tickets across the company." : "Tickets you have assigned to your team."} Approve them here once they&apos;re marked done.
        </p>
        <Button onClick={() => setFormOpen(true)} disabled={assignable.length === 0}>
          <Plus /> Assign ticket
        </Button>
      </div>
      {assignable.length === 0 && (
        <Alert>
          <AlertDescription>
            No one is in your team yet — on the Employees page, set &ldquo;Reports to&rdquo; to you (and make sure your login is linked to your employee record).
          </AlertDescription>
        </Alert>
      )}
      <StatusFilter value={filter} onChange={setFilter} counts={counts} total={assigned.length} />
      {visible.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets" />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((t) => (
            <TaskCard key={`${t.id}-${t.updated_at}`} task={t} mode="assigned" onReview={(action) => review(t.id, action)} onDelete={() => remove(t.id)} />
          ))}
        </div>
      )}
      <AssignTicketDialog open={formOpen} onOpenChange={setFormOpen} employees={assignable} />
    </div>
  );
}
