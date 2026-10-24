import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid, Users, CalendarCheck, CalendarClock, Wallet, Briefcase, Star, CreditCard, ShieldCheck,
  CalendarDays, PartyPopper, Ticket, Fingerprint, ClipboardList, KeyRound, CalendarRange, FileBarChart, Scale,
} from "lucide-react";
import useCan from "../../hooks/useCan";

// Sidebar menu. An item with `children` is a collapsible group; it opens
// automatically while one of its pages is active.
const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/employees", label: "Employees", icon: Users, permission: "employees.view" },
  {
    key: "my-attendance",
    label: "My Attendance",
    icon: CalendarDays,
    permission: "attendance.self",
    children: [
      { to: "/my-attendance", label: "Attendance", icon: Fingerprint, end: true },
      { to: "/my-attendance/calendar", label: "Attendance Calendar", icon: CalendarRange },
      { to: "/my-attendance/report", label: "Attendance Report", icon: FileBarChart },
      { to: "/my-attendance/leaves", label: "Leave View Approval", icon: ClipboardList },
    ],
  },
  { to: "/attendance", label: "Team Attendance", icon: CalendarCheck, permission: "attendance.view" },
  { to: "/leave", label: "Leave", icon: CalendarClock, permission: "leave.apply" },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/change-password", label: "Change Password", icon: KeyRound },
  { to: "/payroll", label: "Payroll", icon: Wallet, permission: "payroll.view" },
  { to: "/recruitment", label: "Recruitment", icon: Briefcase, permission: "recruitment.view" },
  { to: "/performance", label: "Performance", icon: Star, permission: "performance.view" },
  { to: "/holidays", label: "Holidays", icon: PartyPopper, permission: "holidays.manage" },
  { to: "/leave-policy", label: "Leave Policy", icon: Scale, permission: "leavePolicy.manage" },
  { to: "/billing", label: "Billing", icon: CreditCard, permission: "billing.view" },
  { to: "/users", label: "Users & Roles", icon: ShieldCheck, permission: "users.manage" },
];

const linkClass = (isActive, nested = false) =>
  `group relative flex items-center gap-3 ${nested ? "pl-9 pr-3 py-2" : "px-3 py-2.5"} rounded-lg text-sm transition-colors ` +
  (isActive
    ? "bg-sidebarfg/[0.12] text-sidebarfg font-medium"
    : "text-sidebarfg/70 hover:bg-sidebarfg/[0.06] hover:text-sidebarfg");

function NavItem({ to, label, icon: Icon, end, nested }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => linkClass(isActive, nested)}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brass" />}
          <Icon size={nested ? 15 : 17} className={isActive ? "text-brass" : "text-sidebarfg/60 group-hover:text-sidebarfg"} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ item }) {
  const { pathname } = useLocation();
  const childActive = item.children.some((c) => (c.end ? pathname === c.to : pathname.startsWith(c.to)));
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  useEffect(() => { if (childActive) setOpen(true); }, [childActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          childActive ? "text-sidebarfg font-medium" : "text-sidebarfg/70 hover:bg-sidebarfg/[0.06] hover:text-sidebarfg"
        }`}
      >
        <Icon size={17} className={childActive ? "text-brass" : "text-sidebarfg/60 group-hover:text-sidebarfg"} />
        <span className="flex-1 text-left">{item.label}</span>
      </button>
      {open && (
        <div className="relative mt-0.5 flex flex-col gap-0.5 before:absolute before:left-[1.4rem] before:top-1 before:bottom-1 before:w-px before:bg-sidebarfg/15">
          {item.children.map((child) => <NavItem key={child.to} {...child} nested />)}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const can = useCan();

  return (
    <aside className="w-[236px] shrink-0 h-screen sticky top-0 bg-gradient-to-b from-sidebar to-sidebar2 text-sidebarfg flex flex-col border-r border-black/10">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-[72px] border-b border-sidebarfg/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brass to-[#8F6326] flex items-center justify-center font-serif text-white text-base shadow-md">
          H
        </div>
        <div className="font-serif text-lg tracking-wide">Sangvya</div>
      </div>

      <div className="px-5 pt-5 pb-1.5 text-3xs uppercase tracking-[0.14em] text-sidebarfg/40 font-semibold">Menu</div>
      <nav className="px-3 pb-4 flex-1 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) =>
          item.children ? <NavGroup key={item.key} item={item} /> : <NavItem key={item.to} {...item} />
        )}
      </nav>
    </aside>
  );
}
