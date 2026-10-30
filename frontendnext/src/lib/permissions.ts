// Access in the app comes from the user's designation, decided by the backend:
//   • pages      — from the Page Master, sent with login / GET /auth/me (and as URLs in the access token)
//   • permissions — API actions, sent as user.permissions (check with useCan)
// This file only holds the names and the URL matching; there are no rules here.

// Mirrors PERMISSION_KEYS in backend/src/config/permissions.ts
export type Permission =
  | "companies.manage"
  | "users.manage"
  | "employees.view"
  | "employees.manage"
  | "dashboard.company"
  | "designations.manage"
  | "departments.manage"
  | "roles.manage"
  | "pages.manage"
  | "admins.manage"
  | "platform.companies"
  | "platform.audit"
  | "platform.overview"
  | "attendance.view"
  | "attendance.mark"
  | "attendance.self"
  | "holidays.manage"
  | "leave.apply"
  | "leave.applyForOthers"
  | "leave.viewAll"
  | "leave.approve"
  | "leave.approveUnassigned"
  | "leavePolicy.manage"
  | "payroll.self"
  | "payroll.view"
  | "payroll.manage"
  | "recruitment.view"
  | "recruitment.candidates"
  | "recruitment.manage"
  | "performance.view"
  | "performance.review"
  | "performance.manageCycles"
  | "tasks.assign"
  | "tasks.assignAnyone"
  | "announcements.manage"
  | "reports.attendance"
  | "reports.leave"
  | "reports.payroll"
  | "reports.people"
  | "reports.settings"
  | "billing.view"
  | "billing.manage";

// Logged-out pages. A logged-in user visiting one is sent to the dashboard.
export const PUBLIC_ROUTES = ["/login", "/forgot-password"];

// Open to everyone, logged in or not (an activation link may be opened in a
// browser where someone else is logged in — accepting it switches the login)
export const OPEN_ROUTES = ["/activate"];

// Where a logged-in user without a company sets one up (no sidebar)
export const ONBOARDING_ROUTE = "/onboarding";

// Always open to a logged-in user, whatever the Page Master says. (Onboarding is
// only reachable without a company — proxy.ts sends everyone else to the dashboard.)
const ALWAYS_OPEN = ["/", "/forbidden", ONBOARDING_ROUTE];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isPublicRoute = (pathname: string) => PUBLIC_ROUTES.some((p) => matches(pathname, p));
export const isOpenRoute = (pathname: string) => OPEN_ROUTES.some((p) => matches(pathname, p));

// Can someone with these page URLs open `pathname`? A page also covers its
// sub-routes (/payroll → /payroll/123), except "/" which only means the dashboard.
export function canVisit(urls: readonly string[] | undefined, pathname: string): boolean {
  if (ALWAYS_OPEN.includes(pathname)) return true;
  return (urls ?? []).some((url) => (url === "/" ? pathname === "/" : matches(pathname, url)));
}
