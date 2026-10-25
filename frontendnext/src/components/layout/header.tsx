"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth-store";
import { CompanySwitcher } from "@/components/companies/company-switcher";
import { ProfileButton } from "./profile-panel";
import { SidebarNav } from "./sidebar";
import { WorkTimer } from "./work-timer";
import { CheckInButton } from "@/components/attendance/check-in-dialog";

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return { text: "Good morning", emoji: "🌅" };
  if (h >= 12 && h < 17) return { text: "Good afternoon", emoji: "☀️" };
  if (h >= 17 && h < 21) return { text: "Good evening", emoji: "🌇" };
  return { text: "Good night", emoji: "🌙" };
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Top bar on every logged-in page: greeting · work timer + check-in · company + profile
export function Header() {
  const user = useAuthStore((s) => s.user);
  // Read the clock in the browser only (the server's time zone may differ)
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  const greeting = now ? greetingFor(now) : null;

  return (
    <header className="sticky top-0 z-30 grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileMenu />
        <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl sm:flex" aria-hidden>
          {greeting?.emoji}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            Hi, <span className="text-primary">{user?.name}</span>
            {greeting && <span className="hidden font-normal text-muted-foreground sm:inline"> · {greeting.text}</span>}
          </div>
          <div className="hidden truncate text-xs text-muted-foreground sm:block">
            {now?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-self-center">
        <WorkTimer />
        <CheckInButton />
      </div>

      <div className="flex items-center gap-2 justify-self-end">
        <CompanySwitcher />
        <ProfileButton />
      </div>
    </header>
  );
}
