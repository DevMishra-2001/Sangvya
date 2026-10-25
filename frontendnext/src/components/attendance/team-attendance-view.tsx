"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isoDate } from "@/lib/format";
import type { AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { DatePicker } from "@/components/common/date-picker";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; className: string }[] = [
  { value: "present", label: "Present", className: "data-[active=true]:border-success data-[active=true]:bg-success/10 data-[active=true]:text-success" },
  { value: "half", label: "Half day", className: "data-[active=true]:border-warning data-[active=true]:bg-warning/10 data-[active=true]:text-warning" },
  { value: "absent", label: "Absent", className: "data-[active=true]:border-destructive data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive" },
];

// HR / managers mark everyone's attendance for a date
export function TeamAttendanceView() {
  const canMark = useCan()("attendance.mark");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const records = useAttendanceStore((s) => s.byDate[date]);
  const load = useAttendanceStore((s) => s.load);
  const mark = useAttendanceStore((s) => s.mark);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (date) load(date);
  }, [date, load]);

  const statusFor = (employeeId: number) => records?.find((r) => r.employee_id === employeeId)?.status;

  return (
    <div>
      <PageHeader
        title="Team Attendance"
        description="Mark attendance for employees who don't punch in themselves."
        actions={<DatePicker value={date} onChange={setDate} max={isoDate(new Date())} className="w-44" aria-label="Date" />}
      />
      {employees.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No employees yet" description='Add employees first from the "Employees" page.' />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                {canMark && <TableHead>Mark</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => {
                const status = statusFor(emp.id);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={status ?? "unset"}>{status ?? "Not marked"}</StatusBadge>
                    </TableCell>
                    {canMark && (
                      <TableCell>
                        <div className="flex gap-1.5" role="group" aria-label={`Mark ${emp.name}`}>
                          {STATUS_OPTIONS.map((opt) => (
                            <Button
                              key={opt.value}
                              variant="outline"
                              size="sm"
                              data-active={status === opt.value}
                              aria-pressed={status === opt.value}
                              className={cn(opt.className)}
                              onClick={() => mark(emp.id, date, opt.value)}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
