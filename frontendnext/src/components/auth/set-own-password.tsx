"use client";

import { LogOut } from "lucide-react";
import { ForceLight } from "@/components/layout/force-light";
import { useAuthStore } from "@/stores/auth-store";
import { ChangePasswordForm } from "./change-password-form";

// "Welcome! Choose your own password" — for someone logging in with a temporary password
export function SetOwnPassword({ name, onDone, onLoggedOut }: { name: string; onDone: () => void; onLoggedOut: () => void }) {
  const logout = useAuthStore((s) => s.logout);
  return (
    <>
      <ForceLight />
      <ChangePasswordForm
        title={`Welcome, ${name.split(" ")[0]}!`}
        subtitle="You're logging in with a temporary password. Choose your own password to continue."
        submitLabel="Set password & continue"
        onSuccess={onDone}
        footer={
          <div className="border-t border-slate-100 pt-4 text-center">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
              onClick={async () => {
                await logout();
                onLoggedOut();
              }}
            >
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        }
      />
    </>
  );
}
