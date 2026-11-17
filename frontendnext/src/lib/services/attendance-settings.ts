import { api } from "@/lib/api/client";
import type { Id } from "@/lib/types";

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

// Attendance Settings row (company rules)
export interface AttendanceSettings {
  company_id: Id;
  default_required_minutes: number;
  default_break_minutes: number;
  status_by_hours: boolean;
  half_day_below_minutes: number;
  absent_below_minutes: number;
  late_penalty_enabled: boolean;
  late_marks_per_penalty: number;
  late_penalty: "half" | "full";
  count_early_leaving: boolean;
  early_leaving_grace_minutes: number;
  off_saturdays: string | null;
  photo_rule: "required" | "optional" | "off";
  location_rule: "required" | "optional";
  geofence_enabled: boolean;
  early_check_in_minutes: number | null;
  missing_checkout: "flag" | "shift_end" | "half";
  corrections_enabled: boolean;
  correction_days_back: number;
  corrections_per_month: number | null;
  overtime_enabled: boolean;
  overtime_after_minutes: number;
  created_at: string | null;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
}

export interface AttendanceSettingsData {
  settings: AttendanceSettings;
  workDays: WeekDay[];
}

export const attendanceSettingsService = {
  get: async () => (await api.get<AttendanceSettingsData>("/attendance/settings")).data,
  save: async (body: Record<string, unknown>) => (await api.put<AttendanceSettingsData>("/attendance/settings", body)).data,
};
