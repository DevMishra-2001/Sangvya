"use client";

// Pieces shared by the three expense pages: the balance strip, status names, the bill picker
import { useEffect, useRef, useState } from "react";
import { FileUp, Info, Paperclip, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { expensesService, type AdvanceStatus, type Attachment, type ClaimStatus, type ExpenseBalance } from "@/lib/services/expenses";
import { cn } from "@/lib/utils";

export const STATUS: Record<AdvanceStatus | ClaimStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  submitted: { label: "Submitted", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  on_hold: { label: "On hold", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

function Item({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className={cn("font-semibold", strong ? "text-foreground" : "text-muted-foreground")}>{label} : </span>
      <span className={cn("font-semibold tabular-nums", value < 0 ? "text-destructive" : value > 0 ? "text-success" : "text-foreground")}>{money(value)}</span>
    </span>
  );
}

// "Against TA/DA: Opening … | Current month advance … | Closing …" — loads once, refresh on demand
export function BalanceStrip({ employeeId, month, label = "Against TA/DA", className }: { employeeId?: number; month?: string; label?: string; className?: string }) {
  const [b, setB] = useState<ExpenseBalance | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    expensesService
      .balance({ employeeId, month })
      .then((x) => !cancelled && setB(x))
      .catch(() => !cancelled && setB(null));
    return () => {
      cancelled = true;
    };
  }, [employeeId, month]);

  async function refresh() {
    setLoading(true);
    const r = await run(() => expensesService.balance({ employeeId, month }), { silent: true });
    setLoading(false);
    if (r.ok) setB(r.data);
  }

  if (b === null) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-1.5 text-[13px]", className)}>
      {b === undefined ? (
        <Spinner />
      ) : (
        <>
          <span className="font-semibold">{label}:</span>
          <Item label="Opening Balance" value={b.opening} />
          <span className="text-muted-foreground">|</span>
          <Item label="Current Month Advance" value={b.monthAdvance} />
          <span className="text-muted-foreground">|</span>
          <Item label="Current Month Expense" value={b.monthExpense} />
          <span className="text-muted-foreground">|</span>
          <Item label="Last Paid Amount" value={b.lastPaid} />
          <span className="text-muted-foreground">|</span>
          <Item label="Closing Balance" value={b.closing} strong />
          <Button variant="ghost" size="icon-sm" onClick={refresh} disabled={loading} aria-label="Refresh balance">
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="ml-auto size-4 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              TA/DA advances paid to you, minus approved expenses, plus reimbursements paid. Negative = the company owes you.{b.lastPaidOn && ` Last paid ${fmtDate(b.lastPaidOn)}.`}
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

// Upload bills one by one; shows the list with remove buttons
export function BillPicker({ files, onChange, disabled }: { files: Attachment[]; onChange: (f: Attachment[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const added: Attachment[] = [];
    for (const f of Array.from(list).slice(0, 10 - files.length)) {
      const r = await run(() => expensesService.upload(f));
      if (r.ok) added.push(r.data);
    }
    setBusy(false);
    onChange([...files, ...added]);
    if (ref.current) ref.current.value = "";
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" multiple accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => pick(e.target.files)} />
      <Button type="button" variant="secondary" disabled={disabled || busy || files.length >= 10} onClick={() => ref.current?.click()}>
        {busy ? <Spinner /> : <FileUp />} Select File
      </Button>
      {files.map((f, i) => (
        <span key={f.path} className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <Paperclip className="size-3" /> <span className="max-w-40 truncate">{f.name}</span>
          {!disabled && (
            <button type="button" aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => onChange(files.filter((_, j) => j !== i))}>
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
