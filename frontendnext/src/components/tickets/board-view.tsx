"use client";

// Task Tracker: one employee's tickets as a kanban board. Drag a card to move it (desktop),
// or use its menu (phone / tablet). Columns swipe sideways on small screens.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, CalendarCheck, CheckCircle2, Clock, FolderKanban, MoreVertical, Plus } from "lucide-react";
import { FormHeading } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { ticketsService, type BoardData, type TicketRow } from "@/lib/services/tickets";
import type { Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, DueChip, mins } from "./ticket-shared";
import { TicketSheet } from "./ticket-sheet";

function Counter({ icon: Icon, n, label, tone }: { icon: typeof Clock; n: number; label: string; tone: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      <Icon className="size-3.5" />
      <b className="tabular-nums">{n}</b> {label}
    </span>
  );
}

function Card({ t, statuses, onOpen, onMove, dragging, setDragging }: { t: TicketRow; statuses: BoardData["statuses"]; onOpen: () => void; onMove: (statusId: Id) => void; dragging: boolean; setDragging: (id: Id | null) => void }) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(t.id));
        e.dataTransfer.effectAllowed = "move";
        setDragging(t.id);
      }}
      onDragEnd={() => setDragging(null)}
      onClick={onOpen}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-2.5 shadow-xs transition-all hover:-translate-y-px hover:shadow-md active:cursor-grabbing",
        dragging && "opacity-40",
        t.delayed && "border-destructive/40",
      )}
      style={{ borderLeft: `3px solid ${t.priority_color ?? t.status_color}` }}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-2xs font-bold text-primary">{t.code}</span>
        {t.priority_name && <ColorBadge color={t.priority_color}>{t.priority_name}</ColorBadge>}
        {t.delayed && <AlertTriangle className="size-3.5 text-destructive" aria-label="Delayed" />}
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-xs" aria-label={`Move ${t.code}`} className="-mr-1 opacity-60 group-hover:opacity-100">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              <ArrowRightLeft className="size-3.5" /> Move to
            </DropdownMenuLabel>
            {statuses
              .filter((s) => s.id !== t.status_id)
              .map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => onMove(s.id)}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-1 line-clamp-2 text-sm leading-snug font-medium">{t.title}</p>
      {(t.project_name || t.category_name) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {t.project_name && <span className="max-w-full truncate text-2xs text-muted-foreground">{[t.project_name, t.module_name].filter(Boolean).join(" › ")}</span>}
          {t.category_name && <ColorBadge color={t.category_color}>{t.category_name}</ColorBadge>}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t pt-1.5">
        <DueChip date={t.due_date} delayed={t.delayed} />
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground tabular-nums">
          <Clock className="size-3" />
          {mins(t.spent_minutes)}
          {t.estimate_minutes ? ` / ${mins(t.estimate_minutes)}` : ""}
        </span>
      </div>
    </article>
  );
}

export function BoardView() {
  const url = useUrlParams();
  const loadMeta = useTicketMeta((s) => s.load);
  const meta = useTicketMeta((s) => s.meta);
  const employee = url.getNumber("employee", 0) || undefined;
  const openId = url.getNumber("id", 0) || null;
  const [data, setData] = useState<BoardData | null>(null);
  const [version, setVersion] = useState(0);
  const [dragging, setDragging] = useState<Id | null>(null);
  const [over, setOver] = useState<Id | null>(null);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    let cancelled = false;
    run(() => ticketsService.board(employee)).then((r) => !cancelled && r.ok && setData(r.data));
    return () => {
      cancelled = true;
    };
  }, [employee, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const closeSheet = useCallback(() => url.set({ id: null }), [url]);

  // Move right away on screen; undo if the server says no
  async function move(ticketId: Id, statusId: Id) {
    if (!data) return;
    const before = data;
    const target = data.statuses.find((s) => s.id === statusId);
    if (!target) return;
    setData({ ...data, tickets: data.tickets.map((t) => (t.id === ticketId ? { ...t, status_id: statusId, status_name: target.name, status_color: target.color, status_kind: target.kind } : t)) });
    const r = await run(() => ticketsService.setStatus(ticketId, statusId), { success: `Moved to ${target.name}` });
    if (!r.ok) setData(before);
    else refresh();
  }

  if (!data) return <Skeleton className="h-[70vh] rounded-xl" />;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title="Task Tracker"
          icon={FolderKanban}
          actions={
            meta?.can.create && (
              <Button size="sm" asChild>
                <Link href="/tickets/new">
                  <Plus /> New Ticket
                </Link>
              </Button>
            )
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {data.people.length > 1 ? (
            <SelectField
              className="w-full sm:w-64"
              value={String(data.employee.id)}
              onValueChange={(v) => url.set({ employee: Number(v) === meta?.me.employeeId ? null : v })}
              searchable
              aria-label="Employee"
              options={data.people.map((p) => ({ value: String(p.id), label: p.name }))}
            />
          ) : (
            <span className="text-sm font-medium">{data.employee.name}</span>
          )}
          <span className="flex-1" />
          <Counter icon={AlertTriangle} n={data.counts.delayed} label="Delayed" tone="bg-destructive/10 text-destructive" />
          <Counter icon={CalendarCheck} n={data.counts.dueToday} label="Due today" tone="bg-warning/15 text-warning" />
          <Counter icon={CheckCircle2} n={data.counts.onTime} label="On time" tone="bg-success/10 text-success" />
        </div>
      </section>

      {/* Columns: swipe on phones, scroll on desktop */}
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
        {data.statuses.map((s) => {
          const cards = data.tickets.filter((t) => t.status_id === s.id);
          return (
            <section
              key={s.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                const card = data.tickets.find((t) => t.id === id);
                if (card && card.status_id !== s.id) move(id, s.id);
              }}
              className={cn("flex w-[85vw] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 transition-colors sm:w-72 xl:w-[19rem]", over === s.id && "bg-primary/10 ring-2 ring-primary/40")}
            >
              <header className="flex items-center gap-2 rounded-t-xl border-b bg-card px-3 py-2" style={{ borderTop: `3px solid ${s.color}` }}>
                <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <h3 className="text-[13px] font-semibold">{s.name}</h3>
                <span className="ml-auto rounded-full px-2 py-0.5 text-2xs font-bold tabular-nums" style={{ backgroundColor: `${s.color}1f`, color: s.color }}>
                  {cards.length}
                </span>
              </header>
              <div className="flex max-h-[calc(100dvh-15rem)] min-h-32 flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <p className="m-auto py-6 text-center text-xs text-muted-foreground">{dragging ? "Drop here" : "Nothing here"}</p>
                ) : (
                  cards.map((t) => <Card key={t.id} t={t} statuses={data.statuses} dragging={dragging === t.id} setDragging={setDragging} onOpen={() => url.set({ id: t.id })} onMove={(statusId) => move(t.id, statusId)} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      <TicketSheet ticketId={openId} onClose={closeSheet} onChanged={refresh} />
    </div>
  );
}
