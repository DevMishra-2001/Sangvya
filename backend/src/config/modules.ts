// Modules the Super Admin can switch on/off per company (Companies → details).
// Switching one off removes its pages (Page Master slugs) and its permissions
// for everyone in that company, so its menu items disappear and its API calls
// are refused (requirePermission). Everything else in the app always stays on.
import type { Permission } from "./permissions.js";

export interface ModuleDef {
  key: string;
  name: string;
  description: string;
  pages: string[];
  permissions: Permission[];
}

export const MODULES: ModuleDef[] = [
  {
    key: "attendance",
    name: "Attendance",
    description: "Check in/out, shifts, late marks, corrections, team attendance and reports",
    pages: ["attendance", "my-attendance-today", "my-attendance-calendar", "my-attendance-report", "my-attendance-corrections", "shifts", "reports-attendance-register", "reports-late-arrivals"],
    permissions: ["attendance.self", "attendance.view", "attendance.mark", "shifts.manage", "reports.attendance"],
  },
  {
    key: "leave",
    name: "Leave",
    description: "Leave requests, approvals and leave policy",
    pages: ["leave", "leave-policy", "my-attendance-leaves", "reports-leave-requests", "reports-leave-balances"],
    permissions: ["leave.apply", "leave.applyForOthers", "leave.viewAll", "leave.approve", "leave.approveUnassigned", "leavePolicy.manage", "reports.leave"],
  },
  {
    key: "payroll",
    name: "Payroll",
    description: "Salary structures, payroll runs and payslips",
    pages: ["payroll", "my-payslips", "reports-payroll-register"],
    permissions: ["payroll.self", "payroll.view", "payroll.manage", "reports.payroll"],
  },
  {
    key: "recruitment",
    name: "Recruitment",
    description: "Job postings and candidates",
    pages: ["recruitment"],
    permissions: ["recruitment.view", "recruitment.candidates", "recruitment.manage"],
  },
  {
    key: "performance",
    name: "Performance",
    description: "Review cycles and performance reviews",
    pages: ["performance"],
    permissions: ["performance.view", "performance.review", "performance.manageCycles"],
  },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
