// Who can do what. Mirrors PERMISSIONS in backend/src/config/permissions.ts —
// keep the two in sync. The backend still enforces every rule on every API
// call; this copy only decides which pages/buttons a role gets to see, and lets
// proxy.ts guard pages before they render (it only knows the role from the token).

export const ROLES = ["superadmin", "hr", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

// Higher number = more authority. A user can only manage accounts below their level.
export const ROLE_LEVEL: Record<Role, number> = { superadmin: 4, hr: 3, manager: 2, employee: 1 };

const ALL: readonly Role[] = ROLES;

export const PERMISSIONS = {
  "companies.manage": ["superadmin"],
  "users.manage": ["superadmin", "hr"],
  "employees.view": ["superadmin", "hr", "manager"],
  "employees.manage": ["superadmin", "hr"],
  "attendance.view": ["superadmin", "hr", "manager"],
  "attendance.mark": ["superadmin", "hr", "manager"],
  "attendance.self": ALL,
  "holidays.manage": ["superadmin", "hr"],
  "leave.apply": ALL,
  "leave.applyForOthers": ["superadmin", "hr"],
  "leave.viewAll": ["superadmin", "hr", "manager"],
  "leave.approve": ["superadmin", "hr", "manager"],
  "leave.approveUnassigned": ["superadmin", "hr"],
  "leavePolicy.manage": ["superadmin", "hr"],
  "payroll.view": ["superadmin", "hr"],
  "payroll.manage": ["superadmin", "hr"],
  "recruitment.view": ["superadmin", "hr", "manager"],
  "recruitment.candidates": ["superadmin", "hr", "manager"],
  "recruitment.manage": ["superadmin", "hr"],
  "performance.view": ["superadmin", "hr", "manager"],
  "performance.review": ["superadmin", "hr", "manager"],
  "performance.manageCycles": ["superadmin", "hr"],
  "tasks.assign": ["superadmin", "hr", "manager"],
  "tasks.assignAnyone": ["superadmin", "hr"],
  "announcements.manage": ["superadmin", "hr", "manager"],
  "billing.view": ["superadmin"],
  "billing.manage": ["superadmin"],
} satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: string | undefined, permission: Permission): boolean {
  return Boolean(role) && (PERMISSIONS[permission] as readonly string[]).includes(role as string);
}

// ---- Pages ----

// Logged-out pages. A logged-in user visiting one is sent to the dashboard.
export const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

// Pages that need a permission (prefix match). Pages not listed here only need a login.
export const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/companies", permission: "companies.manage" },
  { prefix: "/designations", permission: "employees.manage" },
  { prefix: "/employees", permission: "employees.view" },
  { prefix: "/attendance", permission: "attendance.view" },
  { prefix: "/my-attendance", permission: "attendance.self" },
  { prefix: "/leave-policy", permission: "leavePolicy.manage" },
  { prefix: "/leave", permission: "leave.apply" },
  { prefix: "/payroll", permission: "payroll.view" },
  { prefix: "/recruitment", permission: "recruitment.view" },
  { prefix: "/performance", permission: "performance.view" },
  { prefix: "/holidays", permission: "holidays.manage" },
  { prefix: "/billing", permission: "billing.view" },
  { prefix: "/users", permission: "users.manage" },
];

// Where a logged-in superadmin without a company sets one up (no sidebar)
export const ONBOARDING_ROUTE = "/onboarding";

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPublicRoute = (pathname: string) => PUBLIC_ROUTES.some((p) => matches(pathname, p));

export function permissionForRoute(pathname: string): Permission | null {
  return ROUTE_PERMISSIONS.find((r) => matches(pathname, r.prefix))?.permission ?? null;
}

export function canVisit(role: string | undefined, pathname: string): boolean {
  const permission = permissionForRoute(pathname);
  return !permission || roleCan(role, permission);
}
