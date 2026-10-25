import { api } from "@/lib/api/client";
import type { Holiday, Id } from "@/lib/types";
import type { HolidayInput } from "@/lib/schemas/holiday";

export const holidaysService = {
  list: async () => (await api.get<{ holidays: Holiday[] }>("/holidays")).data.holidays,
  create: async (input: HolidayInput) => (await api.post<{ holiday: Holiday }>("/holidays", input)).data.holiday,
  remove: async (id: Id) => {
    await api.delete(`/holidays/${id}`);
  },
};
