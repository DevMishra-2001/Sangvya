"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyForm } from "./company-form";

// A superadmin adding another company; they're switched to it once created
export function NewCompanyView() {
  const router = useRouter();
  return (
    <div>
      <PageHeader title="New company" description="It gets its own employees, attendance, payroll and billing. Switch between your companies from the header." />
      <Card className="max-w-4xl">
        <CardContent>
          <CompanyForm submitLabel="Create and switch" onCreated={() => router.push("/")} />
        </CardContent>
      </Card>
    </div>
  );
}
