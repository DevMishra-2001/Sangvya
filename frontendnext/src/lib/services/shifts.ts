import { api } from "@/lib/api/client";
import type { Id, Shift } from "@/lib/types";

export interface ShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}

export const shiftsService = {
  list: async () => (await api.get<{ shifts: Shift[] }>("/shifts")).data.shifts,
  create: async (input: ShiftPayload) => (await api.post<{ shift: Shift }>("/shifts", input)).data.shift,
  update: async (id: Id, input: ShiftPayload) => (await api.put<{ shift: Shift }>(`/shifts/${id}`, input)).data.shift,
  remove: async (id: Id) => {
    await api.delete(`/shifts/${id}`);
  },
};
