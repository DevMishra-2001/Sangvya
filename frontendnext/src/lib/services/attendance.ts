import { api } from "@/lib/api/client";
import type { AttendanceRow, AttendanceStatus, Id, ISODate } from "@/lib/types";

export interface MachineImportCheck {
  format: string;
  punches: number;
  from: ISODate | null;
  to: ISODate | null;
  days: { employeeId: Id; name: string; code: string; date: ISODate; in: string; out: string | null; times: string[] }[];
  dayCount: number;
  people: { name: string; code: string; days: number }[];
  unmatched: { code: string; punches: number }[];
  errors: { line: number; message: string }[];
  errorCount: number;
}

const fileForm = (file: File) => {
  const form = new FormData();
  form.append("file", file, file.name);
  return form;
};

export const attendanceService = {
  checkMachineImport: async (file: File) => (await api.post<MachineImportCheck>("/attendance/import/check", fileForm(file))).data,
  runMachineImport: async (file: File) =>
    (await api.post<{ saved: number; people: number; from: ISODate; to: ISODate; unmatched: { code: string; punches: number }[] }>("/attendance/import", fileForm(file))).data,
  byDate: async (date: ISODate) => (await api.get<{ attendance: AttendanceRow[] }>("/attendance", { params: { date } })).data.attendance,
  mark: async (employeeId: Id, date: ISODate, status: AttendanceStatus) =>
    (await api.post<{ attendance: AttendanceRow }>("/attendance", { employeeId, date, status })).data.attendance,
};
