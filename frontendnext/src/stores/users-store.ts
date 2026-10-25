import { create } from "zustand";
import { run } from "@/lib/api/run";
import type { Role } from "@/lib/permissions";
import type { UserPayload } from "@/lib/schemas/user";
import { usersService } from "@/lib/services/users";
import type { Id, UserRow } from "@/lib/types";

interface UsersState {
  list: UserRow[];
  roles: Role[];
  load: () => Promise<void>;
  add: (payload: UserPayload) => Promise<boolean>;
  update: (id: Id, payload: { role?: Role; employeeId?: Id | null }) => Promise<boolean>;
  remove: (id: Id) => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  list: [],
  roles: [],

  async load() {
    const result = await run(usersService.list);
    if (result.ok) set({ list: result.data.users, roles: result.data.roles });
  },

  async add(payload) {
    const result = await run(() => usersService.create(payload), { success: "User login created" });
    if (result.ok) await get().load(); // the list row also carries the linked employee's name
    return result.ok;
  },

  async update(id, payload) {
    const result = await run(() => usersService.update(id, payload), { success: "User updated" });
    if (result.ok) await get().load();
    return result.ok;
  },

  async remove(id) {
    const result = await run(() => usersService.remove(id), { success: "User removed" });
    if (result.ok) set({ list: get().list.filter((u) => u.id !== id) });
  },
}));
