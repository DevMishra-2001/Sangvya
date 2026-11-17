"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { run } from "@/lib/api/run";
import { fmtDate } from "@/lib/format";
import { leavesService } from "@/lib/services/leaves";
import type { EmployeeBalances } from "@/lib/types";

// HR: everyone's leave balances today — available / quota per type
export function LeaveBalancesTable() {
  const [data, setData] = useState<Awaited<ReturnType<typeof leavesService.balances>> | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    run(leavesService.balances).then((r) => r.ok && setData(r.data));
  }, []);

  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;
  // Columns: every balance type anyone has, in the company's order
  const columns: { code: string; short: string }[] = [];
  for (const r of data.employees) for (const b of r.balances.types ?? []) if (b.code && !columns.some((c) => c.code === b.code)) columns.push({ code: b.code, short: b.short ?? b.code });
  const rows: EmployeeBalances[] = data.employees.filter((r) => !q.trim() || r.employee.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search balances" />
        {data.leaveYear && (
          <span className="text-xs text-muted-foreground">
            Leave year {fmtDate(data.leaveYear.start)} – {fmtDate(data.leaveYear.end)} ({data.leaveYear.kind}) · monthly types are this month&apos;s · available / quota
          </span>
        )}
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              {columns.map((c) => (
                <TableHead key={c.code} className="text-right">
                  {c.short}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ employee, balances }) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Link href={`/employees/${employee.id}`} className="flex items-center gap-2.5 font-medium hover:text-primary hover:underline">
                    <PersonAvatar name={employee.name} photoUrl={employee.photo_url} />
                    <span className="min-w-0">
                      <span className="block truncate">{employee.name}</span>
                      {employee.department && <span className="block truncate text-xs font-normal text-muted-foreground">{employee.department}</span>}
                    </span>
                  </Link>
                </TableCell>
                {columns.map((c) => {
                  const b = balances[c.code];
                  if (!b) return <TableCell key={c.code} className="text-right text-muted-foreground">—</TableCell>;
                  return (
                    <TableCell key={c.code} className="text-right tabular-nums">
                      {b.unlimited ? (
                        <span className="text-muted-foreground">{b.used} used</span>
                      ) : (
                        <>
                          <span className={b.available === 0 && b.quota > 0 ? "text-destructive" : undefined}>{b.available}</span>
                          <span className="text-muted-foreground"> / {b.quota}</span>
                        </>
                      )}
                      {(b.carriedForward ?? 0) > 0 && <span className="block text-xs text-muted-foreground">+{b.carriedForward} carried</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-8 text-center text-muted-foreground">
                  No one matches “{q}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
