"use client";

// Everything the command palette and the keyboard shortcuts can do — only what the user may open
import { useMemo } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardPen,
  FilePlus,
  FolderKanban,
  LayoutDashboard,
  LayoutList,
  LogIn,
  LogOut,
  Receipt,
  Ticket,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { canVisit } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { buildNav, isGroup, pageUrls } from "./nav-items";

export interface PageEntry {
  href: string;
  label: string;
  group: string | null; // the menu group it sits in
  icon: LucideIcon;
}

export interface CommandEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string; // go here
  event?: string; // or fire this window event (e.g. open the check-in dialog)
  keys?: string[]; // keyboard shortcut, e.g. ["g", "t"]
  group: "Go to" | "Create" | "Attendance";
  keywords?: string[];
}

// Pages the user can open, in menu order, with their group name
export function useMenuPages(): PageEntry[] {
  const pages = useAuthStore((s) => s.pages);
  const teamSize = useAuthStore((s) => s.user?.team_size ?? 0);
  return useMemo(() => {
    const nav = buildNav(
      teamSize ? pages : pages.filter((p) => p.slug !== "my-team"),
    );
    return nav.flatMap((item): PageEntry[] =>
      isGroup(item)
        ? item.children.map((c) => ({
            href: c.href,
            label: c.label,
            group: item.label,
            icon: c.icon,
          }))
        : [
            {
              href: item.href,
              label: item.label,
              group: null,
              icon: item.icon,
            },
          ],
    );
  }, [pages, teamSize]);
}

// The first of these URLs the user can open
const firstOpen = (urls: string[], candidates: string[]) =>
  candidates.find((c) => canVisit(urls, c.split("?")[0]!));

const DEFS: {
  id: string;
  label: string;
  icon: LucideIcon;
  group: CommandEntry["group"];
  urls?: string[];
  event?: string;
  keys?: string[];
  keywords?: string[];
}[] = [
  {
    id: "go-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Go to",
    urls: ["/"],
    keys: ["g", "d"],
  },
  {
    id: "go-attendance",
    label: "My attendance",
    icon: CalendarCheck,
    group: "Go to",
    urls: ["/my-attendance"],
    keys: ["g", "a"],
  },
  {
    id: "go-leave",
    label: "Leave",
    icon: CalendarDays,
    group: "Go to",
    urls: ["/leave", "/my-attendance/leaves"],
    keys: ["g", "l"],
  },
  {
    id: "go-tickets",
    label: "Tickets",
    icon: LayoutList,
    group: "Go to",
    urls: ["/tickets"],
    keys: ["g", "t"],
  },
  {
    id: "go-board",
    label: "Task tracker",
    icon: FolderKanban,
    group: "Go to",
    urls: ["/tickets/board"],
    keys: ["g", "b"],
    keywords: ["kanban"],
  },
  {
    id: "go-expenses",
    label: "Expenses",
    icon: Receipt,
    group: "Go to",
    urls: ["/expenses"],
    keys: ["g", "x"],
  },
  {
    id: "go-employees",
    label: "Employees",
    icon: Users,
    group: "Go to",
    urls: ["/employees"],
    keys: ["g", "e"],
  },
  {
    id: "go-payroll",
    label: "Payroll",
    icon: Wallet,
    group: "Go to",
    urls: ["/payroll"],
    keys: ["g", "p"],
  },
  {
    id: "new-ticket",
    label: "New ticket",
    icon: Ticket,
    group: "Create",
    urls: ["/tickets/new"],
    keys: ["n", "t"],
    keywords: ["raise", "issue", "bug"],
  },
  {
    id: "new-leave",
    label: "Apply leave",
    icon: CalendarPlus,
    group: "Create",
    urls: ["/leave?apply=1", "/my-attendance/leaves"],
    keys: ["n", "l"],
    keywords: ["holiday", "off", "cl", "sl"],
  },
  {
    id: "new-expense",
    label: "New expense",
    icon: FilePlus,
    group: "Create",
    urls: ["/expenses/new"],
    keys: ["n", "e"],
    keywords: ["claim", "bill", "reimbursement"],
  },
  {
    id: "new-advance",
    label: "Advance request",
    icon: Wallet,
    group: "Create",
    urls: ["/expenses/advance"],
    keywords: ["salary advance", "ta da"],
  },
  {
    id: "new-employee",
    label: "Add employee",
    icon: UserPlus,
    group: "Create",
    urls: ["/employees"],
    keywords: ["hire", "staff"],
  },
  {
    id: "correction",
    label: "Ask for an attendance correction",
    icon: ClipboardPen,
    group: "Attendance",
    urls: ["/my-attendance/corrections"],
    keywords: ["regularise", "regularize", "missed"],
  },
];

// Actions and "go to" shortcuts the user can use right now
export function useCommands(): CommandEntry[] {
  const pages = useAuthStore((s) => s.pages);
  const employeeId = useAuthStore((s) => s.user?.employee_id);
  return useMemo(() => {
    const urls = pageUrls(pages);
    const list: CommandEntry[] = [];
    for (const d of DEFS) {
      const href = d.urls ? firstOpen(urls, d.urls) : undefined;
      if (d.urls && !href) continue;
      list.push({
        id: d.id,
        label: d.label,
        icon: d.icon,
        group: d.group,
        href,
        keys: d.keys,
        keywords: d.keywords,
      });
    }
    // Check in / out from anywhere, when the user tracks attendance
    if (employeeId && canVisit(urls, "/my-attendance")) {
      list.push({
        id: "check-in",
        label: "Check in / Check out",
        icon: LogIn,
        group: "Attendance",
        event: "wk:check-in",
        keys: ["c", "i"],
        keywords: ["punch", "attendance"],
      });
    }
    return list;
  }, [pages, employeeId]);
}

export const LOGOUT_ICON = LogOut;

// "g t" → ["G", "T"] for display
export const keyLabel = (keys: string[]) => keys.map((k) => k.toUpperCase());
