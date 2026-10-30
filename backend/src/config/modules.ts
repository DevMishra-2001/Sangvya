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
    description: "Check in/out, team attendance, attendance calendar and report",
    pages: ["attendance", "my-attendance-today", "my-attendance-calendar", "my-attendance-report"],
    permissions: ["attendance.self", "attendance.view", "attendance.mark"],
  },
  {
    key: "leave",
    name: "Leave",
    description: "Leave requests, approvals and leave policy",
    pages: ["leave", "leave-policy", "my-attendance-leaves"],
    permissions: ["leave.apply", "leave.applyForOthers", "leave.viewAll", "leave.approve", "leave.approveUnassigned", "leavePolicy.manage"],
  },
  {
    key: "payroll",
    name: "Payroll",
    description: "Salary structures, payroll runs and payslips",
    pages: ["payroll"],
    permissions: ["payroll.view", "payroll.manage"],
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
