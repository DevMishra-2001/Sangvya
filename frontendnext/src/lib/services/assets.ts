import { api } from "@/lib/api/client";
import type { Id } from "@/lib/types";

export const ASSET_CATEGORY_LABELS = {
  laptop: "Laptop",
  desktop: "Desktop",
  monitor: "Monitor",
  mouse: "Mouse",
  keyboard: "Keyboard",
  headset: "Headset",
  charger: "Charger",
  phone: "Phone",
  tablet: "Tablet",
  sim: "SIM card",
  id_card: "ID card",
  access_card: "Access card",
  vehicle: "Vehicle",
  furniture: "Furniture",
  accessory: "Accessory",
  other: "Other",
} as const;
export type AssetCategory = keyof typeof ASSET_CATEGORY_LABELS;
export const ASSET_STATUS_LABELS = { available: "Available", assigned: "Assigned", in_repair: "In repair", retired: "Retired", lost: "Lost" } as const;
export type AssetStatus = keyof typeof ASSET_STATUS_LABELS;
export const ASSET_CONDITION_LABELS = { new: "New", good: "Good", fair: "Fair", damaged: "Damaged" } as const;
export type AssetCondition = keyof typeof ASSET_CONDITION_LABELS;

export interface Asset {
  id: Id;
  asset_code: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: string | null;
  warranty_until: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  branch_id: Id | null;
  branch: string | null;
  notes: string | null;
  holder_id: Id | null;
  holder_name: string | null;
  held_since: string | null;
}

export interface AssetHistoryRow {
  id: Id;
  employee_id: Id;
  employee_name: string;
  assigned_on: string;
  expected_return: string | null;
  assign_notes: string | null;
  returned_on: string | null;
  return_condition: AssetCondition | null;
  return_notes: string | null;
  assigned_by: string | null;
}

export interface EmployeeAssetRow {
  assignment_id: Id;
  asset_id: Id;
  asset_code: string;
  name: string;
  category: AssetCategory;
  serial_number: string | null;
  assigned_on: string;
  expected_return: string | null;
  returned_on: string | null;
  return_condition: AssetCondition | null;
}

export interface AssetPayload {
  assetCode: string | null;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyUntil: string | null;
  condition: AssetCondition;
  branchId: number | null;
  notes: string | null;
}

type Page = { page: number; limit: number; total: number; pages: number };

export const assetsService = {
  list: async (params: { page: number; limit: number; search?: string; status?: string; category?: string }) =>
    (await api.get<{ assets: Asset[]; stats: Record<string, number> & { total: number; value: number } } & Page>("/assets", { params })).data,
  available: async () =>
    (await api.get<{ assets: Pick<Asset, "id" | "asset_code" | "name" | "category" | "brand" | "model" | "serial_number">[] }>("/assets/available")).data.assets,
  assignMany: async (body: {
    employeeId: number;
    items: { assetId?: Id | null; category: string; tag?: string | null }[];
    assignedOn: string;
    expectedReturn?: string | null;
    notes?: string | null;
  }) => (await api.post<{ assigned: number; added: number }>("/assets/assign", body)).data,
  create: async (body: AssetPayload) => (await api.post<{ asset: Asset }>("/assets", body)).data.asset,
  update: async (id: Id, body: AssetPayload) => (await api.put<{ asset: Asset }>(`/assets/${id}`, body)).data.asset,
  remove: async (id: Id) => {
    await api.delete(`/assets/${id}`);
  },
  assign: async (id: Id, body: { employeeId: number; assignedOn: string; expectedReturn?: string | null; notes?: string | null }) =>
    (await api.post<{ asset: Asset }>(`/assets/${id}/assign`, body)).data.asset,
  giveBack: async (id: Id, body: { returnedOn: string; condition: AssetCondition; status: "available" | "in_repair" | "retired" | "lost"; notes?: string | null }) =>
    (await api.post<{ asset: Asset }>(`/assets/${id}/return`, body)).data.asset,
  setStatus: async (id: Id, status: AssetStatus, notes?: string) => (await api.post<{ asset: Asset }>(`/assets/${id}/status`, { status, notes })).data.asset,
  history: async (id: Id) => (await api.get<{ history: AssetHistoryRow[] }>(`/assets/${id}/history`)).data.history,
  ofEmployee: async (employeeId: Id) => (await api.get<{ current: EmployeeAssetRow[]; past: EmployeeAssetRow[] }>(`/assets/employee/${employeeId}`)).data,
};
