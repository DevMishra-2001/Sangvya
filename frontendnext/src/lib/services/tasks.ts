import { api } from "@/lib/api/client";
import type { AssignableEmployee, Id, Task, TaskStats, TaskStatus } from "@/lib/types";
import type { TaskPayload } from "@/lib/schemas/task";

export const tasksService = {
  mine: async () => (await api.get<{ tasks: Task[]; stats: TaskStats }>("/tasks/mine")).data,
  assigned: async () => (await api.get<{ tasks: Task[] }>("/tasks/assigned")).data.tasks,
  assignable: async () => (await api.get<{ employees: AssignableEmployee[] }>("/tasks/assignable")).data.employees,
  create: async (payload: TaskPayload) => (await api.post<{ task: Task }>("/tasks", payload)).data.task,
  progress: async (id: Id, status: TaskStatus, progress: number) =>
    (await api.patch<{ task: Task }>(`/tasks/${id}/progress`, { status, progress })).data.task,
  review: async (id: Id, action: "approve" | "reopen") => (await api.patch<{ task: Task }>(`/tasks/${id}/review`, { action })).data.task,
  remove: async (id: Id) => {
    await api.delete(`/tasks/${id}`);
  },
};
