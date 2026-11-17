import { useEffect } from "react";
import { create } from "zustand";
import { api } from "@/lib/api/client";
import { run } from "@/lib/api/run";

// The company's leave types (Leave Settings) — loaded once, used for labels and the apply form
export interface LeaveTypeInfo {
  code: string;
  name: string;
  short_name: string;
  color: string;
  kind: "quota" | "comp_off" | "unpaid";
  is_paid: boolean;
  quota_period: "year" | "month" | "none";
  allow_half_day: boolean;
  document_after_days: number | null;
  is_active: boolean;
}

// Before the list loads (or for a code it doesn't know)
const FALLBACK: Record<string, [string, string]> = {
  leave: ["Leave", "Leave"],
  cl: ["Casual Leave (CL)", "CL"],
  sl: ["Sick Leave (SL)", "SL"],
  ol: ["Optional Leave (OL)", "OL"],
  el: ["Earned Leave (EL)", "EL"],
  comp_off: ["Comp Off", "Comp Off"],
  lop: ["Unpaid Leave (LOP)", "LOP"],
};

interface State {
  types: LeaveTypeInfo[] | null;
  load: (force?: boolean) => Promise<void>;
}

let loading: Promise<void> | null = null;

export const useLeaveTypesStore = create<State>((set, get) => ({
  types: null,
  load(force) {
    if (get().types && !force) return Promise.resolve();
    loading ??= run(async () => (await api.get<{ types: LeaveTypeInfo[] }>("/leaves/types")).data.types, { silent: true })
      .then((r) => {
        if (r.ok) set({ types: r.data });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },
}));

const EMPTY: LeaveTypeInfo[] = [];

// Labels and lists for leave types; loads them on first use
export function useLeaveTypes() {
  const types = useLeaveTypesStore((s) => s.types) ?? EMPTY;
  const load = useLeaveTypesStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  const find = (code: string) => types.find((t) => t.code === code);
  return {
    types,
    // "Casual Leave (CL)"
    name: (code: string) => {
      const t = find(code);
      return t ? (t.short_name && t.short_name !== t.name ? `${t.name} (${t.short_name})` : t.name) : (FALLBACK[code]?.[0] ?? code);
    },
    // "CL"
    short: (code: string) => find(code)?.short_name ?? FALLBACK[code]?.[1] ?? code,
    color: (code: string) => find(code)?.color ?? null,
    // What people can apply for now
    applicable: types.filter((t) => t.is_active),
    find,
  };
}
