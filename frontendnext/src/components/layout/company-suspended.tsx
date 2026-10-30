"use client";

// Shown instead of the app when the Super Admin has suspended the current
// company. Someone who also belongs to another company can switch to it.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LogOut } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { Button } from "@/components/ui/button";
import { run } from "@/lib/api/run";
import { companiesService } from "@/lib/services/companies";
import type { CompanyListItem } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

export function CompanySuspended({ companyName }: { companyName: string }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const [others, setOthers] = useState<CompanyListItem[]>([]);

  useEffect(() => {
    run(companiesService.mine, { silent: true }).then((r) => r.ok && setOthers(r.data.filter((c) => !c.current)));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Ban className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{companyName} is suspended</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This company&apos;s Workkind account has been suspended, so it can&apos;t be used right now. Please contact your company admin or Workkind support.
        </p>
        {others.length > 0 && (
          <div className="mt-6 text-left">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Open another of your companies</p>
            <div className="flex flex-col gap-2">
              {others.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="justify-start"
                  onClick={async () => {
                    if (await switchCompany(c.id)) window.location.replace(new URL("/", window.location.origin));
                  }}
                >
                  <CompanyLogo name={c.name} logoUrl={c.logo_url} className="size-5 rounded text-xs" /> {c.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="mt-6"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <LogOut /> Log out
        </Button>
      </div>
    </main>
  );
}
