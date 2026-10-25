"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StarRating } from "@/components/common/star-rating";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/format";
import type { Id } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCan } from "@/stores/auth-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { usePerformanceStore } from "@/stores/performance-store";
import { CycleFormDialog } from "./cycle-form-dialog";
import { ReviewFormDialog, type ReviewTarget } from "./review-form-dialog";
import { SelectField } from "@/components/common/select-field";

export function PerformanceView() {
  const can = useCan();
  const canManageCycles = can("performance.manageCycles");
  const canReview = can("performance.review");
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const cycles = usePerformanceStore((s) => s.cycles);
  const reviewsByCycle = usePerformanceStore((s) => s.reviewsByCycle);
  const loadCycles = usePerformanceStore((s) => s.loadCycles);
  const loadReviews = usePerformanceStore((s) => s.loadReviews);
  const setCycleStatus = usePerformanceStore((s) => s.setCycleStatus);
  const setReviewStatus = usePerformanceStore((s) => s.setReviewStatus);
  const [tab, setTab] = useState("cycles");
  const [selectedCycleId, setSelectedCycleId] = useState<Id | null>(null);
  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);

  useEffect(() => {
    loadEmployees();
    loadCycles();
  }, [loadEmployees, loadCycles]);

  useEffect(() => {
    if (selectedCycleId) loadReviews(selectedCycleId);
  }, [selectedCycleId, loadReviews]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);
  const reviews = selectedCycleId ? (reviewsByCycle[selectedCycleId] ?? []) : [];

  return (
    <div>
      <PageHeader title="Performance Review" description="Review cycles and each employee's rating, strengths and goals." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="cycles">Review cycles</TabsTrigger>
          <TabsTrigger value="reviews" disabled={!selectedCycleId}>
            Reviews{selectedCycle ? ` — ${selectedCycle.name}` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="flex flex-col gap-3">
          {canManageCycles && (
            <div className="flex justify-end">
              <Button onClick={() => setCycleFormOpen(true)}>
                <Plus /> New cycle
              </Button>
            </div>
          )}
          {cycles.length === 0 ? (
            <EmptyState icon={Star} title="No review cycles yet" description={canManageCycles ? 'Click "New cycle" to get started.' : undefined} />
          ) : (
            cycles.map((cycle) => (
              <Card key={cycle.id} className={cn("py-3.5", selectedCycleId === cycle.id && "border-primary")}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setSelectedCycleId(cycle.id);
                      setTab("reviews");
                    }}
                  >
                    <div className="text-sm font-medium">{cycle.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDate(cycle.start_date)} → {fmtDate(cycle.end_date)} · {cycle.review_count} review{Number(cycle.review_count) === 1 ? "" : "s"}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={cycle.status} />
                    {canManageCycles && (
                      <SelectField
                        size="sm"
                        className="w-auto"
                        value={cycle.status}
                        onValueChange={(v) => setCycleStatus(cycle.id, v as "active" | "closed")}
                        aria-label={`Status of ${cycle.name}`}
                        options={[
                          { value: "active", label: "Active" },
                          { value: "closed", label: "Closed" },
                        ]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {selectedCycleId &&
            (employees.length === 0 ? (
              <EmptyState title="No employees yet" />
            ) : (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-48" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => {
                      const r = reviews.find((x) => x.employee_id === emp.id);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>{r?.rating ? <StarRating value={r.rating} readOnly /> : "—"}</TableCell>
                          <TableCell>{r ? <StatusBadge status={r.status} /> : <StatusBadge status="unset">Not started</StatusBadge>}</TableCell>
                          <TableCell>
                            {canReview && (
                              <div className="flex items-center justify-end gap-1">
                                {r?.status === "submitted" && (
                                  <Button variant="ghost" size="sm" className="text-success" onClick={() => setReviewStatus(selectedCycleId, r.id, "acknowledged")}>
                                    <Check /> Acknowledge
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon-sm" onClick={() => setReviewTarget({ employee: emp, existing: r })} aria-label={`Review ${emp.name}`}>
                                  <Pencil />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            ))}
        </TabsContent>
      </Tabs>
      <CycleFormDialog open={cycleFormOpen} onOpenChange={setCycleFormOpen} />
      {selectedCycleId && <ReviewFormDialog target={reviewTarget} cycleId={selectedCycleId} onClose={() => setReviewTarget(null)} />}
    </div>
  );
}
