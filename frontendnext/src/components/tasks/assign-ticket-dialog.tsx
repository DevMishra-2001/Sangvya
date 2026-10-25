"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isoDate } from "@/lib/format";
import { taskSchema, type TaskForm, type TaskPayload } from "@/lib/schemas/task";
import type { AssignableEmployee } from "@/lib/types";
import { useTasksStore } from "@/stores/tasks-store";
import { FormSelect } from "@/components/common/select-field";
import { FormDatePicker } from "@/components/common/date-picker";

export function AssignTicketDialog({ open, onOpenChange, employees }: { open: boolean; onOpenChange: (open: boolean) => void; employees: AssignableEmployee[] }) {
  const create = useTasksStore((s) => s.create);
  const defaults: TaskForm = { assignedTo: String(employees[0]?.id ?? ""), title: "", description: "", priority: "medium", dueDate: "" };
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskForm, unknown, TaskPayload>({ resolver: zodResolver(taskSchema), defaultValues: defaults });

  useEffect(() => {
    if (open) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(payload: TaskPayload) {
    if (await create(payload)) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a ticket</DialogTitle>
        </DialogHeader>
        <form id="ticket-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label="Assign to" htmlFor="tk-to" error={errors.assignedTo} className="sm:col-span-2">
            <FormSelect
              control={control}
              name="assignedTo"
              id="tk-to"
              placeholder="Choose an employee"
              options={employees.map((e) => ({ value: String(e.id), label: `${e.name}${e.designation ? ` — ${e.designation}` : ""}` }))}
            />
          </FormField>
          <FormField label="Ticket title" htmlFor="tk-title" error={errors.title} className="sm:col-span-2">
            <Input id="tk-title" maxLength={200} aria-invalid={Boolean(errors.title)} {...register("title")} />
          </FormField>
          <FormField label="Description" htmlFor="tk-desc" className="sm:col-span-2">
            <Textarea id="tk-desc" rows={3} {...register("description")} />
          </FormField>
          <FormField label="Priority" htmlFor="tk-priority">
            <FormSelect
              control={control}
              name="priority"
              id="tk-priority"
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
            />
          </FormField>
          <FormField label="Due date" htmlFor="tk-due" error={errors.dueDate}>
            <FormDatePicker control={control} name="dueDate" id="tk-due" min={isoDate(new Date())} placeholder="No due date" clearable />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-form" disabled={isSubmitting}>
            Assign ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
