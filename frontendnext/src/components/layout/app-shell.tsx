"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionKeepAlive } from "@/hooks/use-session-keep-alive";
import { FONT_SIZE, applyFontSize } from "@/lib/appearance";
import { ONBOARDING_ROUTE, canVisit } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { Header } from "./header";
import { pageUrls } from "./nav-items";
import { Sidebar } from "./sidebar";

// Sidebar + header around every logged-in page. proxy.ts already made sure the
// visitor is logged in and allowed on this page; here we load who they are.
// Page content waits for the user inside <PageGate> (see page-gate.tsx).
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const checked = useAuthStore((s) => s.checked);
  const loadMe = useAuthStore((s) => s.loadMe);
  const fontSize = user?.font_size;

  useSessionKeepAlive();

  useEffect(() => {
    if (!checked) loadMe();
  }, [checked, loadMe]);

  // The cookie was there but the session is gone (e.g. revoked) → log in again
  useEffect(() => {
    if (checked && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [checked, user, router, pathname]);

  // No company yet → set one up first (proxy.ts does the same on page loads).
  // A Super Admin can work on the platform pages without one.
  const needsCompany = Boolean(user && !user.company_id && !user.is_superadmin);
  useEffect(() => {
    if (needsCompany) router.replace(ONBOARDING_ROUTE);
  }, [needsCompany, router]);

  // Second line of defense behind proxy.ts (e.g. access changed since the token was issued)
  const pages = useAuthStore((s) => s.pages);
  const allowed = !user || !user.company_id || canVisit(pageUrls(pages), pathname);
  useEffect(() => {
    if (!allowed) router.replace(`/forbidden?from=${encodeURIComponent(pathname)}`);
  }, [allowed, router, pathname]);

  // The user's own font size (logged out → default)
  useEffect(() => {
    applyFontSize(fontSize ?? FONT_SIZE.default);
  }, [fontSize]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
