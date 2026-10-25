"use client";

import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { canVisit } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";

// Wraps every logged-in page's content: a skeleton until the logged-in user is
// loaded (and nothing if their role can't open this page — the app shell is
// already redirecting). Lives in each page rather than the layout so the page
// segment always renders something, which keeps Next.js navigations instant.
export function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  if (!user || !user.company_id) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!canVisit(user.role, pathname)) return null;
  return children;
}
