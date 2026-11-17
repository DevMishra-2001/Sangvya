"use client";

// One ticket in a side panel: details, status, reassign, comments, time log and who-did-what activity
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ExternalLink, MessageSquare, Paperclip, Pencil, Send, Trash2, UserRoundCog } from "lucide-react";
import { AuditInfo } from "@/components/common/audit-info";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, fmtDateTime, isoDate } from "@/lib/format";
import { ticketsService, type TicketPerson, type TicketDetail } from "@/lib/services/tickets";
import type { Id } from "@/lib/types";
import { useTicketMeta } from "@/stores/ticket-meta-store";
import { ColorBadge, DueChip, mins } from "./ticket-shared";

// Stable empty list (a new [] in a store selector re-renders forever)
const NO_PEOPLE: TicketPerson[] = [];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{children || "—"}</span>
    </div>
  );
}

function ReassignDialog({ data, onClose, onDone }: { data: TicketDetail; onClose: () => void; onDone: () => void }) {
  const people = useTicketMeta((s) => s.meta?.people) ?? NO_PEOPLE;
  const [to, setTo] = useState(String(data.ticket.assigned_to ?? ""));
  const [second, setSecond] = useState(String(data.ticket.secondary_assignee ?? ""));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const options = people.map((p) => ({ value: String(p.id), label: p.name }));
  async function save() {
    setBusy(true);
    const r = await run(() => ticketsService.assign(data.ticket.id, { assignedTo: to ? Number(to) : null, secondaryAssignee: second ? Number(second) : null, note: note || undefined }), { success: "Reassigned" });
    setBusy(false);
    if (r.ok) onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign {data.ticket.code}</DialogTitle>
          <DialogDescription>The new people get a notification.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Assign to" htmlFor="ra-to" span="md">
            <SelectField id="ra-to" value={to} onValueChange={setTo} searchable emptyLabel="Nobody" options={options} />
          </FormField>
          <FormField label="Secondary assignee" htmlFor="ra-second" span="md">
            <SelectField id="ra-second" value={second} onValueChange={setSecond} searchable emptyLabel="None" options={options.filter((o) => o.value !== to)} />
          </FormField>
          <FormField label="Note" htmlFor="ra-note" span="full">
            <Input id="ra-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <UserRoundCog />} Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeForm({ id, onDone }: { id: Id; onDone: () => void }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  async function save() {
    setBusy(true);
    const r = await run(() => ticketsService.logTime(id, { workDate: date, minutes, note: note || undefined }), { success: `Logged ${mins(minutes)}` });
    setBusy(false);
    if (r.ok) {
      setH("");
      setM("");
      setNote("");
      onDone();
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_0.7fr_0.7fr]">
        <DatePicker value={date} onChange={setDate} max={isoDate(new Date())} className="col-span-2 sm:col-span-1" />
        <Input type="number" min={0} max={24} placeholder="Hours" aria-label="Hours" value={h} onChange={(e) => setH(e.target.value)} />
        <Input type="number" min={0} max={59} placeholder="Minutes" aria-label="Minutes" value={m} onChange={(e) => setM(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-1">
        {[15, 30, 60, 120, 240].map((q) => (
          <Button
            key={q}
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setH(String(Math.floor(q / 60) || ""));
              setM(String(q % 60 || ""));
            }}
          >
            {mins(q)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="What did you do? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <Button onClick={save} disabled={busy || minutes < 1}>
          {busy ? <Spinner /> : <Clock />} Log
        </Button>
      </div>
    </div>
  );
}

export function TicketSheet({ ticketId, onClose, onChanged }: { ticketId: Id | null; onClose: () => void; onChanged?: () => void }) {
  const meta = useTicketMeta((s) => s.meta);
  const loadMeta = useTicketMeta((s) => s.load);
  const [data, setData] = useState<TicketDetail | null>(null);
  const [version, setVersion] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    run(() => ticketsService.get(ticketId)).then((r) => {
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else onClose();
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId, version, onClose]);

  const changed = () => {
    setVersion((v) => v + 1);
    onChanged?.();
  };
  async function setStatus(statusId: string) {
    if (!data) return;
    if ((await run(() => ticketsService.setStatus(data.ticket.id, Number(statusId)), { success: "Status updated" })).ok) changed();
  }
  async function addComment() {
    if (!data || !comment.trim()) return;
    setBusy(true);
    const r = await run(() => ticketsService.comment(data.ticket.id, comment.trim()));
    setBusy(false);
    if (r.ok) {
      setComment("");
      changed();
    }
  }
  async function openFile(i: number) {
    if (!data) return;
    const r = await run(() => ticketsService.file(data.ticket.id, i));
    if (r.ok) window.open(r.data, "_blank", "noopener");
  }
  async function remove() {
    if (!data) return;
    if ((await run(() => ticketsService.remove(data.ticket.id), { success: `${data.ticket.code} deleted` })).ok) {
      onChanged?.();
      onClose();
    }
  }

  const t = data?.ticket;
  const open = Boolean(ticketId);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && (setData(null), onClose())}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {!t || !data || t.id !== ticketId ? (
          <div className="flex flex-col gap-3 p-5">
            <SheetTitle className="sr-only">Ticket</SheetTitle>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-2 border-b p-4" style={{ borderTop: `3px solid ${t.status_color}` }}>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <span className="font-mono text-sm font-bold text-primary">{t.code}</span>
                <ColorBadge color={t.status_color} dot>
                  {t.status_name}
                </ColorBadge>
                {t.priority_name && <ColorBadge color={t.priority_color}>{t.priority_name}</ColorBadge>}
                {t.category_name && <ColorBadge color={t.category_color}>{t.category_name}</ColorBadge>}
                {t.delayed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-semibold text-destructive">
                    <AlertTriangle className="size-3" /> Delayed
                  </span>
                )}
              </div>
              <SheetTitle className="text-base leading-snug">{t.title}</SheetTitle>
              <SheetDescription>{[t.project_name, t.module_name].filter(Boolean).join(" › ") || "No project"}</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {data.can.edit && meta && (
                  <SelectField
                    size="sm"
                    className="w-44"
                    value={String(t.status_id)}
                    onValueChange={setStatus}
                    aria-label="Change status"
                    options={meta.statuses.filter((s) => s.is_active || s.id === t.status_id).map((s) => ({ value: String(s.id), label: <ColorBadge color={s.color} dot>{s.name}</ColorBadge> }))}
                  />
                )}
                {data.can.assign && (
                  <Button size="sm" variant="outline" onClick={() => setReassigning(true)}>
                    <UserRoundCog /> Reassign
                  </Button>
                )}
                {data.can.edit && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/tickets/new?id=${t.id}`}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                )}
                {data.can.delete && <ConfirmDelete title={`Delete ${t.code}?`} description="The ticket, its comments and time log are removed. This can't be undone." onConfirm={remove} />}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-4 p-4">
              <div className="grid gap-x-6 rounded-lg border px-3 sm:grid-cols-2">
                <div className="divide-y">
                  <Row label="Assigned to">{t.assigned_to_name ?? "Unassigned"}</Row>
                  <Row label="Secondary">{t.secondary_name}</Row>
                  <Row label="Reported by">{[t.reported_by_name, t.reported_by_mobile].filter(Boolean).join(" · ")}</Row>
                  <Row label="Page / URL">
                    {t.page_url && /^https?:\/\//.test(t.page_url) ? (
                      <a href={t.page_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Open <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      t.page_url
                    )}
                  </Row>
                </div>
                <div className="divide-y">
                  <Row label="Delivery date">
                    <DueChip date={t.due_date} delayed={t.delayed} />
                  </Row>
                  <Row label="Time spent">
                    {mins(t.spent_minutes)}
                    {t.estimate_minutes ? <span className="text-muted-foreground"> / {mins(t.estimate_minutes)}</span> : null}
                  </Row>
                  <Row label="Started">{t.started_at ? fmtDateTime(t.started_at) : null}</Row>
                  <Row label="Resolved">{t.resolved_at ? fmtDateTime(t.resolved_at) : null}</Row>
                </div>
              </div>
              <AuditInfo row={t} className="rounded-lg bg-muted/40 px-3 py-2" />

              {t.description && <p className="rounded-lg border bg-muted/20 p-3 text-sm whitespace-pre-wrap">{t.description}</p>}
              {t.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {t.attachments.map((f, i) => (
                    <button key={f.path} type="button" onClick={() => openFile(i)} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      <Paperclip className="size-3" /> {f.name}
                    </button>
                  ))}
                </div>
              )}

              <Tabs defaultValue="comments">
                <TabsList>
                  <TabsTrigger value="comments">
                    <MessageSquare /> Comments ({data.comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="time">
                    <Clock /> Time ({mins(t.spent_minutes)})
                  </TabsTrigger>
                  <TabsTrigger value="activity">Activity ({data.events.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="flex flex-col gap-3 pt-2">
                  {data.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
                  {data.comments.map((c) => (
                    <div key={c.id} className="rounded-lg border p-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold">{c.created_by_name ?? "—"}</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {fmtDateTime(c.created_at)}
                          {c.created_by === meta?.me.userId && (
                            <button
                              type="button"
                              aria-label="Delete comment"
                              className="hover:text-destructive"
                              onClick={async () => (await run(() => ticketsService.deleteComment(t.id, c.id))).ok && changed()}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Textarea rows={2} placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
                    <Button className="self-end" onClick={addComment} disabled={busy || !comment.trim()} aria-label="Send comment">
                      {busy ? <Spinner /> : <Send />}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="time" className="flex flex-col gap-3 pt-2">
                  {data.can.log && <TimeForm id={t.id} onDone={changed} />}
                  {data.time.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No time logged yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {data.time.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <span className="w-24 shrink-0 text-xs text-muted-foreground">{fmtDate(l.work_date)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{l.employee_name}</span>
                            {l.note && <span className="block truncate text-xs text-muted-foreground">{l.note}</span>}
                          </span>
                          <span className="font-semibold tabular-nums">{mins(l.minutes)}</span>
                          {l.created_by === meta?.me.userId && (
                            <button type="button" aria-label="Remove time" className="text-muted-foreground hover:text-destructive" onClick={async () => (await run(() => ticketsService.deleteTime(t.id, l.id))).ok && changed()}>
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
                <TabsContent value="activity" className="pt-2">
                  <ol className="relative ml-2 border-l pl-4">
                    {data.events.map((e) => (
                      <li key={e.id} className="mb-3 last:mb-0">
                        <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                        <p className="text-sm">{e.text}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{e.created_by_name ?? "System"}</span> · {fmtDateTime(e.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </TabsContent>
              </Tabs>
            </div>
            {reassigning && (
              <ReassignDialog
                data={data}
                onClose={() => setReassigning(false)}
                onDone={() => {
                  setReassigning(false);
                  changed();
                }}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
