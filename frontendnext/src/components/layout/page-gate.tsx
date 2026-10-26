"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { canVisit } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { pageUrls } from "./nav-items";

// Wraps every logged-in page's content: a skeleton until the logged-in user is
// loaded (and nothing if their designation can't open this page — the app shell is
// already redirecting). Lives in each page rather than the layout so the page
// segment always renders something, which keeps Next.js navigations instant.
export function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const pages = useAuthStore((s) => s.pages);

  // A Super Admin may use the platform pages before having a company
  if (!user || (!user.company_id && !user.is_superadmin)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!canVisit(pageUrls(pages), pathname)) return null;
  return children;
}
