"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuthStore } from "@/stores/auth-store";
import { CompanyForm } from "./company-form";

// First step after signup (proxy.ts sends company-less superadmins here)
export function OnboardingView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const checked = useAuthStore((s) => s.checked);
  const loadMe = useAuthStore((s) => s.loadMe);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!checked) loadMe();
  }, [checked, loadMe]);

  // Already has a company (e.g. created it in another tab) → dashboard
  useEffect(() => {
    if (user?.company_id) router.replace("/");
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex justify-center py-10 text-sm text-muted-foreground">
        <Spinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </div>
        <CardTitle className="text-xl">Set up your company</CardTitle>
        <CardDescription>Welcome, {user.name}! Tell us about your company — you can add more companies later.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CompanyForm submitLabel="Create company" onCreated={() => router.replace("/")} />
        <Button
          variant="link"
          className="self-center text-muted-foreground"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          Log out
        </Button>
      </CardContent>
    </Card>
  );
}
