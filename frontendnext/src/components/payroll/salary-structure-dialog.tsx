"use client";

// Set / revise one person's salary: type the CTC to split it, or fill each component yourself
import { useEffect, useState } from "react";
import { History, Plus, Sparkles, X } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormGrid } from "@/components/common/form-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { fmtDate, inr, isoDate } from "@/lib/format";
import { payrollService } from "@/lib/services/payroll";
import type { CtcTemplate, Employee, SalaryStructure } from "@/lib/types";
import { usePayrollStore } from "@/stores/payroll-store";

type Row = { key: number; label: string; amount: string };
let k = 0;
const row = (label = "", amount = ""): Row => ({ key: ++k, label, amount });
const num = (v: string) => (v === "" ? 0 : Number(v) || 0);
const PF_CEILING = 15000;

// CTC → monthly components using the company template (employer PF comes out of the CTC)
function splitCtc(ctcAnnual: number, t: CtcTemplate, pfCeiling: boolean) {
  const monthlyCtc = ctcAnnual / 12;
  // Employer PF is 12% of basic, so solve gross + PF(basic) = monthly CTC
  let gross = monthlyCtc;
  for (let i = 0; i < 4; i++) {
    const basic = (gross * t.basicPct) / 100;
    const pf = 0.12 * (pfCeiling ? Math.min(basic, PF_CEILING) : basic);
    gross = monthlyCtc - pf;
  }
  const basic = Math.round((gross * t.basicPct) / 100);
  const hra = Math.round((basic * t.hraPctOfBasic) / 100);
  const conveyance = Math.min(t.conveyance, Math.max(0, Math.round(gross) - basic - hra));
  const medical = Math.min(t.medical, Math.max(0, Math.round(gross) - basic - hra - conveyance));
  const special = Math.max(0, Math.round(gross) - basic - hra - conveyance - medical);
  return { basic, hra, components: [row("Conveyance", String(conveyance)), row("Medical", String(medical)), row("Special allowance", String(special))].filter((r) => num(r.amount) > 0) };
}

export function SalaryStructureDialog({ employee, structure, onClose }: { employee: Employee | null; structure?: SalaryStructure; onClose: () => void }) {
  const settings = usePayrollStore((s) => s.settings);
  const setStructure = usePayrollStore((s) => s.setStructure);
  const [ctc, setCtc] = useState("");
  const [basic, setBasic] = useState("");
  const [hra, setHra] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(isoDate(new Date()));
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<SalaryStructure[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill from the current structure when the dialog opens
  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCtc(structure?.ctc_annual ? String(Number(structure.ctc_annual)) : "");
      setBasic(structure ? String(Number(structure.basic)) : "");
      setHra(structure ? String(Number(structure.hra)) : "");
      setRows(structure?.components?.length ? structure.components.map((c) => row(c.label, String(c.amount))) : structure && Number(structure.allowances) ? [row("Allowances", String(Number(structure.allowances)))] : []);
      setFrom(isoDate(new Date()));
      setNote("");
      setHistory(null);
    });
    run(() => payrollService.history(employee.id), { silent: true }).then((r) => !cancelled && setHistory(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, [employee, structure]);

  const monthly = num(basic) + num(hra) + rows.reduce((t, r) => t + num(r.amount), 0);
  const employerPf = Math.round(0.12 * (settings?.pfCeiling === false ? num(basic) : Math.min(num(basic), PF_CEILING)));

  function split() {
    if (!settings || !num(ctc)) return;
    const s = splitCtc(num(ctc), settings.ctcTemplate, settings.pfCeiling);
    setBasic(String(s.basic));
    setHra(String(s.hra));
    setRows(s.components);
  }

  async function save() {
    if (!employee) return;
    setSaving(true);
    const ok = await setStructure({
      employeeId: employee.id,
      basic: num(basic),
      hra: num(hra),
      components: rows.filter((r) => r.label.trim() && num(r.amount) > 0).map((r) => ({ label: r.label.trim(), amount: num(r.amount) })),
      ctcAnnual: num(ctc) || null,
      effectiveFrom: from,
      note: note || undefined,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={Boolean(employee)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{structure ? "Revise salary" : "Set salary"}</DialogTitle>
          <DialogDescription>
            {employee?.name}
            {structure && ` · current ${inr(Number(structure.basic) + Number(structure.hra) + Number(structure.allowances))}/month since ${fmtDate(structure.effective_from)}`}
          </DialogDescription>
        </DialogHeader>

        <FormGrid density="dialog">
          <FormField label="CTC per year (₹)" htmlFor="ss-ctc" span="md" description="Optional — type it and press Split to fill the components">
            <div className="flex gap-2">
              <Input id="ss-ctc" type="number" min={0} value={ctc} onChange={(e) => setCtc(e.target.value)} />
              <Button type="button" variant="outline" onClick={split} disabled={!num(ctc) || !settings}>
                <Sparkles /> Split
              </Button>
            </div>
          </FormField>
          <FormField label="Effective from" htmlFor="ss-from" span="md">
            <DatePicker id="ss-from" value={from} onChange={setFrom} />
          </FormField>

          <FieldSeparator label="Monthly earnings" />
          <FormField label="Basic" htmlFor="ss-basic" required>
            <Input id="ss-basic" type="number" min={0} value={basic} onChange={(e) => setBasic(e.target.value)} />
          </FormField>
          <FormField label="HRA" htmlFor="ss-hra">
            <Input id="ss-hra" type="number" min={0} value={hra} onChange={(e) => setHra(e.target.value)} />
          </FormField>
        </FormGrid>

        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_10rem_auto] items-center gap-2">
              <Input value={r.label} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)))} placeholder="Component name" aria-label="Component name" />
              <Input type="number" min={0} value={r.amount} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))} placeholder="Amount" aria-label={`${r.label || "Component"} amount`} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove component" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                <X />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRows((rs) => [...rs, row()])} disabled={rows.length >= 15}>
            <Plus /> Add component
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Monthly gross</p>
            <p className="font-semibold tabular-nums">{inr(monthly)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Yearly gross</p>
            <p className="font-semibold tabular-nums">{inr(monthly * 12)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Employer PF (est.)</p>
            <p className="font-semibold tabular-nums">{inr(settings?.pfEnabled ? employerPf : 0)}/mo</p>
          </div>
        </div>

        <FormGrid density="dialog">
          <FormField label="Note" htmlFor="ss-note" span="full">
            <Input id="ss-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Annual increment 10%" maxLength={200} />
          </FormField>
        </FormGrid>

        {history && history.length > 0 && (
          <details className="rounded-lg border text-sm">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-medium">
              <History className="size-4" /> Salary history ({history.length})
            </summary>
            <ul className="divide-y border-t">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>
                    From {fmtDate(h.effective_from)}
                    {h.note && <span className="block text-xs text-muted-foreground">{h.note}</span>}
                  </span>
                  <span className="text-right tabular-nums">
                    {inr(Number(h.basic) + Number(h.hra) + Number(h.allowances))}/mo
                    {h.ctc_annual && <span className="block text-xs text-muted-foreground">CTC {inr(Number(h.ctc_annual))}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !num(basic)}>
            {saving && <Spinner />} Save salary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
