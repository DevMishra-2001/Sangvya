import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { TaskPayload } from "@/lib/schemas/task";
import { tasksService } from "@/lib/services/tasks";
import type { AssignableEmployee, Id, Task, TaskStats, TaskStatus } from "@/lib/types";

interface TasksState {
  mine: Task[];
  stats: TaskStats | null;
  assigned: Task[];
  assignable: AssignableEmployee[];
  loadMine: () => Promise<void>;
  loadAssigned: () => Promise<void>;
  loadAssignable: () => Promise<void>;
  create: (payload: TaskPayload) => Promise<boolean>;
  progress: (id: Id, status: TaskStatus, progress: number) => Promise<void>;
  review: (id: Id, action: "approve" | "reopen") => Promise<void>;
  remove: (id: Id) => Promise<void>;
}

const replace = (list: Task[], task: Task) => list.map((t) => (t.id === task.id ? task : t));

export const useTasksStore = create<TasksState>((set, get) => ({
  mine: [],
  stats: null,
  assigned: [],
  assignable: [],

  async loadMine() {
    const result = await run(tasksService.mine, { silent: true });
    if (result.ok) set({ mine: result.data.tasks, stats: result.data.stats });
  },

  async loadAssigned() {
    const result = await run(tasksService.assigned);
    if (result.ok) set({ assigned: result.data });
  },

  async loadAssignable() {
    const result = await run(tasksService.assignable);
    if (result.ok) set({ assignable: result.data });
  },

  async create(payload) {
    const result = await run(() => tasksService.create(payload), { success: "Ticket assigned" });
    if (result.ok) set({ assigned: [result.data, ...get().assigned] });
    return result.ok;
  },

  async progress(id, status, progress) {
    const result = await run(() => tasksService.progress(id, status, progress), {
      success: status === "done" ? "Ticket marked done — waiting for approval" : "Progress updated",
    });
    if (result.ok) await get().loadMine(); // refresh chart stats too
  },

  async review(id, action) {
    const result = await run(() => tasksService.review(id, action), { success: action === "approve" ? "Ticket approved" : "Ticket reopened" });
    if (result.ok) set({ assigned: replace(get().assigned, result.data) });
  },

  async remove(id) {
    const result = await run(() => tasksService.remove(id), { success: "Ticket deleted" });
    if (result.ok) set({ assigned: get().assigned.filter((t) => t.id !== id) });
  },
}));
