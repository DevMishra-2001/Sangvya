"use client";

// The activation link from an invitation email: check the token, let the person
// set their own password, log them in and send them to company setup.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { authService } from "@/lib/services/auth";
import { useAuthStore } from "@/stores/auth-store";
import { ChangePasswordForm } from "./change-password-form";

// Pre-fills the company setup form (read by OnboardingView)
export const COMPANY_DRAFT_KEY = "workkind-company-draft";

type Invite = { name: string; email: string; companyName: string | null };

export function ActivateAccount() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const [state, setState] = useState<{ token: string; invite?: Invite; error?: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authService
      .verifyInvite(token)
      .then((invite) => !cancelled && setState({ token, invite }))
      .catch((err) => !cancelled && setState({ token, error: errorMessage(err, "This activation link isn't valid") }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const current = state?.token === token ? state : null;

  if (!token || current?.error) {
    return (
      <div className="flex w-full flex-col gap-5 text-slate-900">
        <Brand />
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <p className="m-0">{current?.error ?? "This activation link is incomplete. Open the full link from your invitation email."}</p>
        </div>
        <p className="m-0 text-center text-sm text-slate-500">
          Already activated?{" "}
          <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  if (!current?.invite) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Spinner /> Checking your activation link…
      </div>
    );
  }

  const { invite } = current;
  return (
    <ChangePasswordForm
      title={`Welcome, ${invite.name.split(" ")[0]}!`}
      subtitle={`Set a password for ${invite.email} to activate your account${invite.companyName ? ` and set up ${invite.companyName}` : ""}.`}
      submitLabel="Activate account"
      submitPassword={async (password) => {
        const result = await acceptInvite(token, password);
        if (result.ok) {
          try {
            if (result.companyName) sessionStorage.setItem(COMPANY_DRAFT_KEY, result.companyName);
          } catch {
            // storage blocked — the form just starts empty
          }
          router.replace("/onboarding");
        }
        return result.ok;
      }}
      footer={null}
    />
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md shadow-blue-500/20">
        <Users className="size-5 text-white" />
      </div>
      <span className="text-xl font-extrabold tracking-tight text-[#1E293B]">Workkind</span>
    </div>
  );
}
