"use client";

// Shown instead of the app while the user still has a temporary password (one
// their admin set): they choose their own before anything else. The API refuses
// everything else meanwhile (PASSWORD_CHANGE_REQUIRED).
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ForceLight } from "@/components/layout/force-light";
import { useAuthStore } from "@/stores/auth-store";
import { ChangePasswordForm } from "./change-password-form";

export function ForcePasswordChange({ name }: { name: string }) {
  const router = useRouter();
  const changePassword = useAuthStore((s) => s.changePassword);
  const loadMe = useAuthStore((s) => s.loadMe);
  const logout = useAuthStore((s) => s.logout);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <ForceLight />
      <ChangePasswordForm
        title={`Welcome, ${name.split(" ")[0]}!`}
        subtitle="You're logging in with a temporary password. Choose your own password to continue."
        submitLabel="Set password & continue"
        submitPassword={changePassword}
        onSuccess={() => void loadMe()}
        footer={
          <div className="border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        }
      />
    </main>
  );
}
