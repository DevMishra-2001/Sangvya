"use client";

// Schedule an interview round, and give feedback on one
import { useEffect, useState } from "react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { StarRating } from "@/components/common/star-rating";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { isoDate } from "@/lib/format";
import { recruitmentService } from "@/lib/services/recruitment";
import type { CandidateDetail, Interview, Recommendation } from "@/lib/types";
import { useEmployeesStore } from "@/stores/employees-store";
import { MODES, RECOMMEND, options } from "./labels";

// "2026-11-10" + "14:30" in India → ISO with offset
const toIso = (date: string, time: string) => `${date}T${time}:00+05:30`;

export function ScheduleDialog({ candidateId, roundNo, onClose, onDone }: { candidateId: number | null; roundNo: number; onClose: () => void; onDone: (d: CandidateDetail) => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [round, setRound] = useState("");
  const [date, setDate] = useState(() => isoDate(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState("11:00");
  const [duration, setDuration] = useState("45");
  const [mode, setMode] = useState("video");
  const [location, setLocation] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (candidateId == null) return;
    loadEmployees();
    queueMicrotask(() => setRound(roundNo === 1 ? "Round 1 — Screening" : `Round ${roundNo}`));
  }, [candidateId, roundNo, loadEmployees]);

  async function save() {
    if (candidateId == null) return;
    setBusy(true);
    const r = await run(
      () => recruitmentService.schedule(candidateId, { roundName: round, scheduledAt: toIso(date, time), durationMin: Number(duration), mode, location: location || null, interviewerId: Number(interviewer) }),
      { success: "Interview scheduled — the interviewer is notified" },
    );
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onDone(r.data);
  }

  return (
    <Dialog open={candidateId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>The interviewer gets a notification and email, and adds feedback afterwards.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Round" htmlFor="iv-round" required span="md">
            <Input id="iv-round" value={round} onChange={(e) => setRound(e.target.value)} maxLength={80} />
          </FormField>
          <FormField label="Interviewer" htmlFor="iv-who" required span="md">
            <SelectField id="iv-who" value={interviewer} onValueChange={setInterviewer} placeholder="Pick an employee" options={employees.filter((e) => e.status !== "exited").map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` · ${e.designation}` : ""}` }))} />
          </FormField>
          <FormField label="Date" htmlFor="iv-date" required>
            <DatePicker id="iv-date" value={date} onChange={setDate} min={isoDate(new Date())} />
          </FormField>
          <FormField label="Time" htmlFor="iv-time" required>
            <Input id="iv-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
          <FormField label="Minutes" htmlFor="iv-dur">
            <Input id="iv-dur" type="number" min={10} max={480} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </FormField>
          <FormField label="Mode" htmlFor="iv-mode">
            <SelectField id="iv-mode" value={mode} onValueChange={setMode} options={options(MODES)} />
          </FormField>
          <FormField label={mode === "video" ? "Meeting link" : mode === "phone" ? "Number to call" : "Room / address"} htmlFor="iv-loc" span="full">
            <Input id="iv-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !round.trim() || !interviewer || !date || !time}>
            {busy && <Spinner />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackDialog({ interview, onClose, onDone }: { interview: Interview | null; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [rec, setRec] = useState<Recommendation | "">("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!interview) return;
    queueMicrotask(() => {
      setRating(interview.rating);
      setRec(interview.recommendation ?? "");
      setText(interview.feedback ?? "");
    });
  }, [interview]);

  async function save() {
    if (!interview || !rating || !rec) return;
    setBusy(true);
    const r = await run(() => recruitmentService.feedback(interview.id, { rating, recommendation: rec, feedback: text }), { success: "Feedback saved" });
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onDone();
  }

  return (
    <Dialog open={Boolean(interview)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Interview feedback</DialogTitle>
          <DialogDescription>
            {interview?.candidate_name ? `${interview.candidate_name} · ` : ""}
            {interview?.round_name}
          </DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Overall rating" htmlFor="fb-rate" float={false} required span="md">
            <StarRating value={rating} onChange={setRating} />
          </FormField>
          <FormField label="Recommendation" htmlFor="fb-rec" required span="md">
            <SelectField id="fb-rec" value={rec} onValueChange={(v) => setRec(v as Recommendation)} placeholder="Hire?" options={options(RECOMMEND)} />
          </FormField>
          <FormField label="Feedback" htmlFor="fb-text" required span="full">
            <Textarea id="fb-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Strengths, concerns, skills checked…" />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !rating || !rec || text.trim().length < 3}>
            {busy && <Spinner />} Submit feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
