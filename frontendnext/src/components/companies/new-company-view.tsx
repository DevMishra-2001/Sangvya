"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth-store";
import { CompanySetupShell } from "./company-setup-shell";
import { CompanyWizard } from "./company-wizard";

// An Admin adding another company; they're switched to it once created
export function NewCompanyView() {
  const user = useAuthStore((s) => s.user);
  const checked = useAuthStore((s) => s.checked);
  const loadMe = useAuthStore((s) => s.loadMe);

  useEffect(() => {
    if (!checked) loadMe();
  }, [checked, loadMe]);

  return (
    <CompanySetupShell
      title="Add a company"
      subtitle="It gets its own employees, attendance, payroll and billing. Switch between your companies from the header."
      actions={
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft /> Back to dashboard
          </Link>
        </Button>
      }
    >
      {user ? (
        <CompanyWizard userId={user.id} submitLabel="Create and switch" onCreated={() => window.location.replace(new URL("/", window.location.origin))} />
      ) : (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      )}
    </CompanySetupShell>
  );
}
