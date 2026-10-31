"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/auth-store";
import { CompanyLogo } from "@/components/companies/company-logo";
import { CompanySwitcher } from "@/components/companies/company-switcher";
import { ProfileButton } from "./profile-panel";
import { SidebarNav } from "./sidebar";
import { WorkTimer } from "./work-timer";
import { NotificationBell } from "./notification-bell";
import { CheckInButton } from "@/components/attendance/check-in-dialog";

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

// Top bar on every logged-in page: menu (mobile) / brand · work timer + check-in · company + profile
// brand: show the company logo + name (top-menu layout, where there's no sidebar)
export function Header({ brand = false }: { brand?: boolean }) {
  const company = useAuthStore((s) => s.company);

  return (
    <header className="sticky top-0 z-30 grid h-16 grid-cols-[auto_1fr_auto] items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:grid-cols-[1fr_auto_1fr] sm:gap-3 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileMenu />
        {brand && (
          <div className="hidden shrink-0 items-center gap-2.5 border-r pr-4 lg:flex">
            <CompanyLogo name={company?.name ?? "Workkind"} logoUrl={company?.logo_url} />
            <span className="max-w-40 truncate text-base font-semibold tracking-tight" title={company?.name ?? "Workkind"}>
              {company?.name ?? "Workkind"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 justify-self-center">
        <WorkTimer />
        <CheckInButton />
      </div>

      <div className="flex items-center gap-2 justify-self-end">
        <CompanySwitcher />
        <NotificationBell />
        <ProfileButton />
      </div>
    </header>
  );
}
