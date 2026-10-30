"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, ClipboardList, FileBarChart, Fingerprint, History, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/my-attendance", label: "Attendance", icon: Fingerprint },
  { href: "/my-attendance/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/my-attendance/report", label: "Report", icon: FileBarChart },
  { href: "/my-attendance/leaves", label: "Leave approvals", icon: ClipboardList },
  { href: "/my-attendance/corrections", label: "Corrections", icon: History },
  { href: "/my-attendance/holidays", label: "Holidays", icon: PartyPopper },
];

// Tab strip across the top of the My Attendance pages
export function MyAttendanceTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b" aria-label="My Attendance">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
