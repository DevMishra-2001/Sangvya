import { api } from "@/lib/api/client";
import type { Holiday, Id } from "@/lib/types";
import type { HolidayInput } from "@/lib/schemas/holiday";

export const holidaysService = {
  // A year's holidays + the company's weekly offs ("Saturday", "Sunday")
  list: async (year?: number) => (await api.get<{ holidays: Holiday[]; weeklyOffs: string[] }>("/holidays", { params: { year } })).data,
  create: async (input: HolidayInput) => (await api.post<{ holiday: Holiday }>("/holidays", input)).data.holiday,
  update: async (id: Id, input: HolidayInput) => (await api.put<{ holiday: Holiday }>(`/holidays/${id}`, input)).data.holiday,
  remove: async (id: Id) => {
    await api.delete(`/holidays/${id}`);
  },
};
