"use client";

// Biometric machine import: pick the export, see what matches, then save
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { attendanceService, type MachineImportCheck } from "@/lib/services/attendance";

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "—");

export function MachineImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<MachineImportCheck | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);

  function reset() {
    setFile(null);
    setCheck(null);
    if (input.current) input.current.value = "";
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setCheck(null);
    setBusy("check");
    const r = await run(() => attendanceService.checkMachineImport(f));
    setBusy(null);
    if (r.ok) setCheck(r.data);
  }

  async function save() {
    if (!file) return;
    setBusy("save");
    const r = await run(() => attendanceService.runMachineImport(file), { success: (d) => `Saved ${d.saved} attendance day${d.saved === 1 ? "" : "s"} for ${d.people} people` });
    setBusy(null);
    if (!r.ok) return;
    reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from biometric machine</DialogTitle>
          <DialogDescription>Upload the attendance export (CSV, Excel, or the machine&apos;s .txt / .dat log). The machine&apos;s user ID must be the employee code.</DialogDescription>
        </DialogHeader>

        <input ref={input} type="file" accept=".csv,.xlsx,.txt,.dat" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
          disabled={busy !== null}
          className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors hover:border-primary/60 hover:bg-primary/5"
        >
          {busy === "check" ? <Spinner /> : <FileUp className="size-6 text-muted-foreground" />}
          <span className="font-medium">{file ? file.name : "Choose or drop the file"}</span>
          <span className="text-xs text-muted-foreground">One row per punch, or one row per day with In / Out — both work</span>
        </button>

        {check && (
          <div className="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2">
              <span>
                <Fingerprint className="mr-1 inline size-4 text-primary" />
                {check.punches} punches · {check.format}
              </span>
              {check.from && (
                <span>
                  {fmtDate(check.from)} → {fmtDate(check.to)}
                </span>
              )}
              <span className="font-medium text-success">
                <CheckCircle2 className="mr-1 inline size-4" />
                {check.dayCount} days for {check.people.length} people
              </span>
            </div>

            {check.unmatched.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-4 text-warning" /> {check.unmatched.length} machine ID{check.unmatched.length === 1 ? "" : "s"} didn&apos;t match an employee code — skipped
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{check.unmatched.map((u) => `${u.code} (${u.punches})`).join(", ")}</p>
              </div>
            )}
            {check.errorCount > 0 && (
              <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">{check.errorCount} line{check.errorCount === 1 ? "" : "s"} skipped</p>
                {check.errors.slice(0, 5).map((e, i) => (
                  <p key={i}>{e.line ? `Line ${e.line}: ` : ""}{e.message}</p>
                ))}
              </div>
            )}

            {check.days.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {check.days.map((d) => (
                      <TableRow key={`${d.employeeId}-${d.date}`}>
                        <TableCell>
                          {d.name} <span className="text-xs text-muted-foreground">{d.code}</span>
                        </TableCell>
                        <TableCell>{fmtDate(d.date)}</TableCell>
                        <TableCell className="tabular-nums">{hhmm(d.in)}</TableCell>
                        <TableCell className="tabular-nums">{hhmm(d.out)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {check.dayCount > check.days.length && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">First {check.days.length} of {check.dayCount} days shown</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy !== null}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!check || !check.dayCount || busy !== null}>
            {busy === "save" && <Spinner />} Import {check?.dayCount ? `${check.dayCount} days` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
