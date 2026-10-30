// Every report; a new module adds its reports here (plus a Page Master page)
import { attendanceRegister, lateArrivals } from "./definitions/attendance.js";
import { leaveBalancesReport, leaveRequestsReport } from "./definitions/leave.js";
import { payrollRegister } from "./definitions/payroll.js";
import { employeeMaster } from "./definitions/people.js";
import type { ReportDef } from "./types.js";

export const REPORTS: ReportDef[] = [attendanceRegister, lateArrivals, leaveRequestsReport, leaveBalancesReport, payrollRegister, employeeMaster];
