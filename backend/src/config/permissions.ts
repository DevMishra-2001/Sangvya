// "Who can do what" — driven by the user's ROLE (their designation is just a job title).
//
// A user's API permissions are worked out in modules/pages/access.service.ts:
//   1. BASE_PERMISSIONS              everyone with a login
//   2. PAGE_PERMISSIONS[page slug]   for every page their role can open (Page Master)
//   3. ROLE_PERMISSIONS[key]         a few extra powers that aren't a page of their own
// The platform Super Admin has every permission.
// Routes check permission keys (requirePermission), never roles.
import type { RoleKey } from "../db/schemas/role.schema.js";

export const PERMISSION_KEYS = [
  "companies.manage",
  "users.manage",
  "employees.view",
  "employees.manage",
  "dashboard.company",
  "designations.manage",
  "departments.manage",
  "roles.manage",
  "pages.manage",
  "admins.manage",
  "platform.companies",
  "platform.audit",
  "platform.overview",
  "attendance.view",
  "attendance.mark",
  "attendance.self",
  "shifts.manage",
  "holidays.manage",
  "leave.apply",
  "leave.applyForOthers",
  "leave.viewAll",
  "leave.approve",
  "leave.approveUnassigned",
  "leavePolicy.manage",
  "payroll.self",
  "payroll.view",
  "payroll.manage",
  "recruitment.view",
  "recruitment.candidates",
  "recruitment.manage",
  "performance.view",
  "performance.review",
  "performance.manageCycles",
  "tasks.assign",
  "tasks.assignAnyone",
  "announcements.manage",
  "reports.attendance",
  "reports.leave",
  "reports.payroll",
  "reports.people",
  "reports.settings",
  "billing.view",
  "billing.manage",
] as const;
export type Permission = (typeof PERMISSION_KEYS)[number];

// Everyone: own attendance and leave; approve leave / assign tickets only for
// people who report to them (the services enforce the "own team" part)
export const BASE_PERMISSIONS: Permission[] = ["attendance.self", "leave.apply", "leave.approve", "tasks.assign", "payroll.self"];

// What opening a page lets you do in the API. Keys are Page Master slugs; pages
// not listed (dashboard, tickets, my-attendance…) only need the base permissions.
export const PAGE_PERMISSIONS: Record<string, Permission[]> = {
  employees: ["employees.view", "employees.manage"],
  designations: ["designations.manage"],
  departments: ["departments.manage"],
  roles: ["roles.manage"],
  "page-master": ["pages.manage"],
  admins: ["admins.manage"],
  companies: ["platform.companies"],
  "audit-log": ["platform.audit"],
  "platform-dashboard": ["platform.overview"],
  attendance: ["attendance.view", "attendance.mark", "employees.view"],
  payroll: ["payroll.view", "payroll.manage", "employees.view"],
  recruitment: ["recruitment.view", "recruitment.candidates", "recruitment.manage"],
  performance: ["performance.view", "performance.review", "performance.manageCycles", "employees.view"],
  holidays: ["holidays.manage"],
  shifts: ["shifts.manage", "employees.view"],
  "leave-policy": ["leavePolicy.manage"],
  billing: ["billing.view", "billing.manage"],
  users: ["users.manage", "employees.view"],
  "new-company": ["companies.manage"],
  // Reports menu: one page per report, each opens its report API
  "reports-attendance-register": ["reports.attendance"],
  "reports-late-arrivals": ["reports.attendance"],
  "reports-leave-requests": ["reports.leave"],
  "reports-leave-balances": ["reports.leave"],
  "reports-payroll-register": ["reports.payroll"],
  "reports-employee-master": ["reports.people"],
  "reports-settings": ["reports.settings"],
};

// Company-wide powers that come with the role itself
// (dashboard.company = the company overview on the dashboard)
const COMPANY_WIDE: Permission[] = ["leave.viewAll", "leave.applyForOthers", "leave.approveUnassigned", "tasks.assignAnyone", "announcements.manage", "employees.view", "dashboard.company"];
export const ROLE_PERMISSIONS: Partial<Record<RoleKey, Permission[]>> = {
  admin: [...COMPANY_WIDE, "companies.manage"],
  hr: COMPANY_WIDE,
};

// The login role that marks the platform Super Admin (users.role)
export const SUPERADMIN_ROLE = "superadmin";
