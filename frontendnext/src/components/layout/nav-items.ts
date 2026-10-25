import {
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Fingerprint,
  KeyRound,
  LayoutGrid,
  PartyPopper,
  Scale,
  ShieldCheck,
  Star,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { permissionForRoute, type Permission } from "@/lib/permissions";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

// Sidebar menu. Each page's permission comes from ROUTE_PERMISSIONS (lib/permissions.ts),
// the same table proxy.ts uses — so a link shows only if the page would open.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/designations", label: "Designations", icon: BadgeCheck },
  {
    key: "my-attendance",
    label: "My Attendance",
    icon: CalendarDays,
    children: [
      { href: "/my-attendance", label: "Attendance", icon: Fingerprint, exact: true },
      { href: "/my-attendance/calendar", label: "Attendance Calendar", icon: CalendarRange },
      { href: "/my-attendance/report", label: "Attendance Report", icon: FileBarChart },
      { href: "/my-attendance/leaves", label: "Leave View Approval", icon: ClipboardList },
    ],
  },
  { href: "/attendance", label: "Team Attendance", icon: CalendarCheck },
  { href: "/leave", label: "Leave", icon: CalendarClock },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/change-password", label: "Change Password", icon: KeyRound },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  { href: "/recruitment", label: "Recruitment", icon: Briefcase },
  { href: "/performance", label: "Performance", icon: Star },
  { href: "/holidays", label: "Holidays", icon: PartyPopper },
  { href: "/leave-policy", label: "Leave Policy", icon: Scale },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/users", label: "Users & Roles", icon: ShieldCheck },
];

export const isGroup = (item: NavItem): item is NavGroup => "children" in item;

export function isActive(pathname: string, link: NavLink) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

// Menu items the user can open
export function visibleNav(can: (p: Permission) => boolean): NavItem[] {
  const allowed = (href: string) => {
    const permission = permissionForRoute(href);
    return !permission || can(permission);
  };
  return NAV_ITEMS.flatMap((item): NavItem[] => {
    if (!isGroup(item)) return allowed(item.href) ? [item] : [];
    const children = item.children.filter((c) => allowed(c.href));
    return children.length ? [{ ...item, children }] : [];
  });
}
