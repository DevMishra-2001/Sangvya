import { api } from "@/lib/api/client";
import type { PagePayload } from "@/lib/schemas/page";
import type { Id, PageRow } from "@/lib/types";

// Page Master (Super Admin)
export const pagesService = {
  list: async () => (await api.get<{ pages: PageRow[] }>("/pages")).data.pages,
  create: async (payload: PagePayload) => (await api.post<{ page: PageRow }>("/pages", payload)).data.page,
  update: async (id: Id, payload: PagePayload) => (await api.put<{ page: PageRow }>(`/pages/${id}`, payload)).data.page,
  remove: async (id: Id) => {
    await api.delete(`/pages/${id}`);
  },
};
