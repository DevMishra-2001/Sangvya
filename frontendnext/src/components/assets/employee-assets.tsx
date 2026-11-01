"use client";

import { useEffect, useState } from "react";
import { Laptop, Plus } from "lucide-react";
import { FormHeading } from "@/components/common/form-layout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { ASSET_CATEGORY_LABELS, ASSET_CONDITION_LABELS, assetsService, type EmployeeAssetRow } from "@/lib/services/assets";
import type { Id } from "@/lib/types";
import { AssignDialog } from "./asset-dialogs";

function List({ rows, past }: { rows: EmployeeAssetRow[]; past?: boolean }) {
  if (!rows.length) return <p className="p-4 text-sm text-muted-foreground">{past ? "Nothing returned yet." : "No assets with them."}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.assignment_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <Laptop className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">
              <span className="font-mono text-xs text-muted-foreground">{r.asset_code}</span> {r.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {ASSET_CATEGORY_LABELS[r.category]}
              {r.serial_number && ` · ${r.serial_number}`}
            </span>
          </span>
          <span className="text-right text-xs text-muted-foreground">
            {fmtDate(r.assigned_on)} → {past ? fmtDate(r.returned_on) : r.expected_return ? `due ${fmtDate(r.expected_return)}` : "now"}
            {past && r.return_condition && <span className="block">{ASSET_CONDITION_LABELS[r.return_condition]}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Profile tab: what this person has, and what they gave back
export function EmployeeAssets({ employeeId, canAssign = true }: { employeeId: Id; canAssign?: boolean }) {
  const [data, setData] = useState<{
    current: EmployeeAssetRow[];
    past: EmployeeAssetRow[];
  } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    run(() => assetsService.ofEmployee(employeeId)).then((r) => !cancelled && setData(r.ok ? r.data : { current: [], past: [] }));
    return () => {
      cancelled = true;
    };
  }, [employeeId, reloadKey]);

  if (!data) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading
          title={`With them now · ${data.current.length}`}
          icon={Laptop}
          actions={
            canAssign && (
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <Plus /> Assign assets
              </Button>
            )
          }
        />
        <List rows={data.current} />
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title={`Returned · ${data.past.length}`} />
        <List rows={data.past} past />
      </section>
      <AssignDialog open={assignOpen} employeeId={employeeId} onClose={() => setAssignOpen(false)} onDone={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}
