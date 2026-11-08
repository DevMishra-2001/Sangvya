"use client";

// Create / edit a job opening
import { useEffect, useState } from "react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { recruitmentService } from "@/lib/services/recruitment";
import type { JobPosting } from "@/lib/types";
import { useDepartmentsStore } from "@/stores/departments-store";
import { useEmployeesStore } from "@/stores/employees-store";
import { EMPLOYMENT, JOB_STATUS, options } from "./labels";

const EMPTY = { title: "", department: "", location: "", employmentType: "full_time", experienceMin: "", experienceMax: "", salaryMin: "", salaryMax: "", openings: "1", skills: "", hiringManagerId: "", closesOn: "", status: "open", description: "" };
type Form = typeof EMPTY;

export function JobDialog({ open, job, onClose, onSaved }: { open: boolean; job: JobPosting | null; onClose: () => void; onSaved: () => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const departments = useDepartmentsStore((s) => s.list);
  const loadDepartments = useDepartmentsStore((s) => s.load);
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadEmployees();
    loadDepartments();
    const s = (v: unknown) => (v == null ? "" : String(v));
    queueMicrotask(() =>
      setF(
        job
          ? {
              title: job.title,
              department: job.department ?? "",
              location: job.location ?? "",
              employmentType: job.employment_type ?? "full_time",
              experienceMin: s(job.experience_min),
              experienceMax: s(job.experience_max),
              salaryMin: job.salary_min ? String(Number(job.salary_min)) : "",
              salaryMax: job.salary_max ? String(Number(job.salary_max)) : "",
              openings: String(job.openings),
              skills: job.skills ?? "",
              hiringManagerId: job.hiring_manager_id ? String(job.hiring_manager_id) : "",
              closesOn: job.closes_on ?? "",
              status: job.status,
              description: job.description ?? "",
            }
          : EMPTY,
      ),
    );
  }, [open, job, loadEmployees, loadDepartments]);

  const set = (k: keyof Form) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const input = (k: keyof Form) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value) });

  async function save() {
    setBusy(true);
    const body = { ...f, openings: Number(f.openings) || 1, hiringManagerId: f.hiringManagerId || null, closesOn: f.closesOn || null };
    const r = await run(() => (job ? recruitmentService.updateJob(job.id, body) : recruitmentService.createJob(body)), { success: job ? "Job updated" : "Job opened" });
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "New job opening"}</DialogTitle>
          <DialogDescription>Who you&apos;re hiring for, how many, and what it pays.</DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Job title" htmlFor="jb-title" required span="md">
            <Input id="jb-title" {...input("title")} maxLength={150} />
          </FormField>
          <FormField label="Department" htmlFor="jb-dept">
            <SelectField id="jb-dept" value={f.department} onValueChange={set("department")} emptyLabel="—" options={departments.map((d) => ({ value: d.name, label: d.name }))} />
          </FormField>
          <FormField label="Location" htmlFor="jb-loc">
            <Input id="jb-loc" {...input("location")} placeholder="Gurugram / Remote" />
          </FormField>
          <FormField label="Type" htmlFor="jb-type">
            <SelectField id="jb-type" value={f.employmentType} onValueChange={set("employmentType")} options={options(EMPLOYMENT)} />
          </FormField>
          <FormField label="Positions" htmlFor="jb-open">
            <Input id="jb-open" type="number" min={1} {...input("openings")} />
          </FormField>
          <FormField label="Hiring manager" htmlFor="jb-mgr">
            <SelectField id="jb-mgr" value={f.hiringManagerId} onValueChange={set("hiringManagerId")} emptyLabel="—" options={employees.filter((e) => e.status !== "exited").map((e) => ({ value: String(e.id), label: e.name }))} />
          </FormField>
          <FormField label="Status" htmlFor="jb-status">
            <SelectField id="jb-status" value={f.status} onValueChange={set("status")} options={options(JOB_STATUS)} />
          </FormField>

          <FieldSeparator label="Experience & pay" />
          <FormField label="Experience from (yrs)" htmlFor="jb-exmin">
            <Input id="jb-exmin" type="number" min={0} {...input("experienceMin")} />
          </FormField>
          <FormField label="Experience to (yrs)" htmlFor="jb-exmax">
            <Input id="jb-exmax" type="number" min={0} {...input("experienceMax")} />
          </FormField>
          <FormField label="Salary from (₹/year)" htmlFor="jb-smin">
            <Input id="jb-smin" type="number" min={0} {...input("salaryMin")} />
          </FormField>
          <FormField label="Salary to (₹/year)" htmlFor="jb-smax">
            <Input id="jb-smax" type="number" min={0} {...input("salaryMax")} />
          </FormField>
          <FormField label="Apply by" htmlFor="jb-close">
            <DatePicker id="jb-close" value={f.closesOn} onChange={set("closesOn")} clearable />
          </FormField>
          <FormField label="Skills" htmlFor="jb-skills" span="md">
            <Input id="jb-skills" {...input("skills")} placeholder="React, Node.js, SQL" />
          </FormField>
          <FormField label="Job description" htmlFor="jb-desc" span="full">
            <Textarea id="jb-desc" rows={4} {...input("description")} />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !f.title.trim()}>
            {busy && <Spinner />} {job ? "Save" : "Open job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
