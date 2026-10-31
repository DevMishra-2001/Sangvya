"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { run } from "@/lib/api/run";
import { companiesService } from "@/lib/services/companies";
import type { Company } from "@/lib/types";
import { BranchesPanel } from "./branches-panel";
import { CompanyDetailsForm } from "./company-details-form";

// Admin: the current company's details and its branches
export function CompanySettingsView() {
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    let cancelled = false;
    run(companiesService.current).then((r) => !cancelled && r.ok && setCompany(r.data));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Company" description="Your company's details and its offices / branches." className="mb-0" />
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          {company ? <CompanyDetailsForm company={company} onSaved={setCompany} /> : <Skeleton className="h-96 w-full rounded-xl" />}
        </TabsContent>
        <TabsContent value="branches" className="mt-4">
          <BranchesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
