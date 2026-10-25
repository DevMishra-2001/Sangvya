// Single source of truth for "who can do what".
// To change access for a role, edit the PERMISSIONS map below — routes
// reference permission keys (never role names), so nothing else needs to change.
// The frontend receives the current user's permission list from the API,
// so this is the only place access rules live.

export const ROLES = ["superadmin", "hr", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

// Higher number = more authority. Used so a user can never create or edit
// someone at (or above) their own level — e.g. HR can't make a superadmin.
export const ROLE_LEVEL: Record<Role, number> = { superadmin: 4, hr: 3, manager: 2, employee: 1 };

const ALL: readonly Role[] = ROLES;

export const PERMISSIONS = {
  // ---- Companies ---- (a superadmin can own several and switch between them)
  "companies.manage": ["superadmin"],

  // ---- User accounts (logins) ----
  "users.manage": ["superadmin", "hr"],

  // ---- Employees ----
  "employees.view": ["superadmin", "hr", "manager"],
  "employees.manage": ["superadmin", "hr"],

  // ---- Attendance ----
  "attendance.view": ["superadmin", "hr", "manager"],
  "attendance.mark": ["superadmin", "hr", "manager"],
  "attendance.self": ALL, // punch in/out, own calendar (needs a linked employee record)

  // ---- Holidays ----
  "holidays.manage": ["superadmin", "hr"], // everyone sees holidays; these roles add/remove them

  // ---- Leave ----
  "leave.apply": ALL,                               // apply for own leave
  "leave.applyForOthers": ["superadmin", "hr"],     // apply on behalf of any employee
  "leave.viewAll": ["superadmin", "hr", "manager"], // without this, only own leaves are listed
  "leave.approve": ["superadmin", "hr", "manager"], // only the employee's reporting manager; never your own leave
  "leave.approveUnassigned": ["superadmin", "hr"],  // may decide leaves of employees who have no manager set
  "leavePolicy.manage": ["superadmin", "hr"],       // set company CL / SL / OL / EL quotas

  // ---- Payroll ----
  "payroll.view": ["superadmin", "hr"],
  "payroll.manage": ["superadmin", "hr"],

  // ---- Recruitment ----
  "recruitment.view": ["superadmin", "hr", "manager"],
  "recruitment.candidates": ["superadmin", "hr", "manager"], // add/edit candidates, move stages
  "recruitment.manage": ["superadmin", "hr"],                // jobs, delete, convert to employee

  // ---- Performance ----
  "performance.view": ["superadmin", "hr", "manager"],
  "performance.review": ["superadmin", "hr", "manager"],
  "performance.manageCycles": ["superadmin", "hr"],

  // ---- Tasks ---- (everyone sees/updates tasks assigned to them)
  "tasks.assign": ["superadmin", "hr", "manager"], // managers: only to their own team (Reports to)
  "tasks.assignAnyone": ["superadmin", "hr"],       // no team restriction

  // ---- Announcements ---- (everyone reads them)
  "announcements.manage": ["superadmin", "hr", "manager"],

  // ---- Billing ----
  "billing.view": ["superadmin"],
  "billing.manage": ["superadmin"],
} satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// List of permission keys a role holds — sent to the frontend on login/me
// so the UI shows/hides features from this same map.
export function permissionsFor(role: string): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}
