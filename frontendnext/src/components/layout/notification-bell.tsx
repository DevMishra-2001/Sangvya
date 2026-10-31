"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  History,
  Megaphone,
  PartyPopper,
  Receipt,
  ShieldCheck,
  Ticket,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { timeAgo } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNotificationsStore } from "@/stores/notifications-store";


// An icon per kind of notification (the part before the dot)
const ICONS: Record<string, LucideIcon> = {
  leave: CalendarClock,
  correction: History,
  attendance: TimerOff,
  task: Ticket,
  announcement: Megaphone,
  company: ShieldCheck,
  holiday: PartyPopper,
  payslip: Receipt,
};
const iconFor = (n: AppNotification) => ICONS[n.type.split(".")[0]] ?? ClipboardCheck;

// The bell in the header: unread count, the latest notifications; clicking one marks it read and opens its page
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useNotificationsStore((s) => s.unread);
  const list = useNotificationsStore((s) => s.list);
  const nextCursor = useNotificationsStore((s) => s.nextCursor);
  const loading = useNotificationsStore((s) => s.loading);
  const refreshCount = useNotificationsStore((s) => s.refreshCount);
  const load = useNotificationsStore((s) => s.load);
  const loadMore = useNotificationsStore((s) => s.loadMore);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  // Count once when the app loads (login / page refresh); opening the bell refreshes it too
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  function openChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  function openItem(n: AppNotification) {
    void markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(26rem,calc(100vh-10rem))] overflow-y-auto overscroll-contain">
          {loading && list.length === 0 ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <Bell className="size-8 opacity-30" />
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((n) => {
                const Icon = iconFor(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60", !n.read_at && "bg-primary/5")}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {nextCursor && (
            <div className="border-t p-2 text-center">
              <Button variant="ghost" size="sm" className="text-xs" onClick={loadMore}>
                Show older
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
