"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Users } from "lucide-react";
import { PasswordPopover } from "@/components/common/password-hint";
import { Spinner } from "@/components/ui/spinner";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth-store";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
  // Save the password somewhere else (e.g. accepting an invitation) instead of
  // changing the logged-in user's password. Return true on success.
  submitPassword?: (newPassword: string) => Promise<boolean>;
  submitLabel?: string;
  // Replaces the "Back to login" footer (null hides it)
  footer?: React.ReactNode;
}

export function ChangePasswordForm({
  onSuccess,
  title = "Set New Password",
  subtitle = "Choose a secure password for your Workkind account.",
  submitPassword,
  submitLabel = "Update Password",
  footer,
}: ChangePasswordFormProps) {
  const router = useRouter();
  const changePassword = useAuthStore((s) => s.changePassword);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = useWatch({ control, name: "newPassword" });

  async function onSubmit(data: ChangePasswordInput) {
    setBusy(true);
    const ok = await (submitPassword ?? changePassword)(data.newPassword);
    setBusy(false);
    if (!ok) return;
    if (onSuccess) onSuccess();
    else router.replace("/");
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col gap-6 text-slate-900">
      {/* Brand Logo matching Login */}
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
          <Users className="size-5 text-white" />
        </div>
        <span className="font-extrabold text-xl tracking-tight text-[#1E293B]">
          Workkind
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-tight leading-tight flex items-center gap-2 m-0">
          <span>{title}</span>
          <span className="text-xl">🔐</span>
        </h2>
        <p className="text-sm text-slate-500 m-0 leading-relaxed">
          {subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* New Password — rules show in a tooltip while it's focused */}
        <div className="group/pw relative flex flex-col gap-1.5">
          <div className="relative">
            <Lock className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="newPassword"
              type={showNew ? "text" : "password"}
              placeholder="New password"
              autoComplete="new-password"
              autoFocus
              {...register("newPassword")}
              className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 aria-invalid:border-red-500"
            />
            <button
              type="button"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.newPassword?.message && (
            <span className="text-xs font-medium text-red-500 mt-0.5">
              {errors.newPassword.message}
            </span>
          )}
          <PasswordPopover password={newPassword} className="top-12" />
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Lock className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm new password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 aria-invalid:border-red-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirmPassword?.message && (
            <span className="text-xs font-medium text-red-500 mt-0.5">
              {errors.confirmPassword.message}
            </span>
          )}
        </div>

        {/* Blue Gradient Action Button */}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {busy ? (
            <>
              <Spinner className="text-white size-4" />
              <span>Updating password…</span>
            </>
          ) : (
            <>
              <span>{submitLabel}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      {footer !== undefined ? (
        footer
      ) : (
        <div className="border-t border-slate-100 pt-4 text-center">
          <p className="text-sm text-slate-500 m-0">
            Already updated?{" "}
            <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
