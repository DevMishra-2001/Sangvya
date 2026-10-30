"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { COMPANY_DRAFT_KEY } from "@/components/auth/activate-account";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth-store";
import { CompanySetupShell } from "./company-setup-shell";
import { CompanyWizard } from "./company-wizard";

// An Admin's first login: register their company (proxy.ts sends logins without a company here)
export function OnboardingView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const checked = useAuthStore((s) => s.checked);
  const loadMe = useAuthStore((s) => s.loadMe);
  const logout = useAuthStore((s) => s.logout);
  // Company name from the invitation (saved by the activation page)
  const [draftName] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : (sessionStorage.getItem(COMPANY_DRAFT_KEY) ?? "");
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (!checked) loadMe();
  }, [checked, loadMe]);

  // Already has a company (e.g. created it in another tab) → dashboard
  useEffect(() => {
    if (user?.company_id) router.replace("/");
  }, [user, router]);

  return (
    <CompanySetupShell
      title="Set up your company"
      subtitle={user ? `Welcome, ${user.name}! Four short steps and your workspace is ready — you can add more companies later.` : "Loading…"}
      actions={
        user && (
          <>
            <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut /> Log out
            </Button>
          </>
        )
      }
    >
      {user ? (
        <CompanyWizard
          userId={user.id}
          defaultName={draftName}
          submitLabel="Create company"
          onCreated={() => {
            try {
              sessionStorage.removeItem(COMPANY_DRAFT_KEY);
            } catch {
              // nothing to clean up
            }
            router.replace("/");
          }}
        />
      ) : (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      )}
    </CompanySetupShell>
  );
}
