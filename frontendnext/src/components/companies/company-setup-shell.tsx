"use client";

// Full-width white page for company setup (onboarding and "New company") —
// same look as the login page, no dark mode or accent colour; theming starts on the dashboard.
import { Users } from "lucide-react";
import { ForceLight } from "@/components/layout/force-light";

export function CompanySetupShell({ title, subtitle, actions, children }: { title: string; subtitle: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900">
      <ForceLight />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-5 backdrop-blur sm:px-8 lg:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md shadow-blue-500/20">
            <Users className="size-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#1E293B]">Workkind</span>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>
      <div className="w-full px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
