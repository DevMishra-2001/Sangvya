"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { run } from "@/lib/api/run";
import { companiesService } from "@/lib/services/companies";
import type { CompanyListItem } from "@/lib/types";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { CompanyLogo } from "./company-logo";

// Current company in the header. Superadmins can switch between their companies
// or create another; everyone else just sees the name.
export function CompanySwitcher() {
  const company = useAuthStore((s) => s.company);
  const switchCompany = useAuthStore((s) => s.switchCompany);
  const canManage = useCan()("companies.manage");
  const [companies, setCompanies] = useState<CompanyListItem[] | null>(null);

  if (!company) return null;

  const label = (
    <>
      <CompanyLogo name={company.name} logoUrl={company.logo_url} className="size-5 rounded text-xs" />
      <span className="max-w-40 truncate">{company.name}</span>
    </>
  );

  if (!canManage) {
    return <div className="hidden items-center gap-2 text-sm font-medium md:flex">{label}</div>;
  }

  async function choose(id: number) {
    if (id === company?.id) return;
    // Different company → every store holds the old company's data, so do a full
    // page load of the dashboard instead of a client-side navigation
    if (await switchCompany(id)) window.location.replace(new URL("/", window.location.origin));
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) run(companiesService.mine, { silent: true }).then((r) => r.ok && setCompanies(r.data));
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="hidden md:inline-flex" aria-label={`Company: ${company.name}. Switch company`}>
          {label}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your companies</DropdownMenuLabel>
        {(companies ?? [{ ...company, current: true }]).map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => choose(c.id)}>
            <CompanyLogo name={c.name} logoUrl={c.logo_url} className="size-5 rounded text-xs" />
            <span className="flex-1 truncate">{c.name}</span>
            {c.current && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/companies/new">
            <Plus /> New company
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
