"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { PasswordPopover } from "@/components/common/password-hint";
import { Spinner } from "@/components/ui/spinner";
import { run } from "@/lib/api/run";
import { forgotEmailSchema, newPasswordSchema, otpSchema, type NewPasswordInput } from "@/lib/schemas/auth";
import { authService } from "@/lib/services/auth";
import { cn } from "@/lib/utils";

type Step = "email" | "otp" | "password";

const STEPS = [
  { key: "email", label: "Email", Icon: Mail },
  { key: "otp", label: "Verify OTP", Icon: ShieldCheck },
  { key: "password", label: "New password", Icon: KeyRound },
] as const;

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="mb-2 flex items-center justify-between" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 transition-all",
                  done
                    ? "border-[#2563EB] bg-[#2563EB] text-white shadow-xs"
                    : active
                    ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-4 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-400",
                )}
              >
                {done ? <Check className="size-4 stroke-[3]" /> : <s.Icon className="size-4" />}
              </span>
              <span className={cn("text-xs whitespace-nowrap", active || done ? "font-semibold text-slate-800" : "text-slate-400 font-medium")}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={cn("mx-2 mb-6 h-[2px] flex-1 rounded", done ? "bg-[#2563EB]" : "bg-slate-200")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ForgotPasswordFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailForm = useForm({ resolver: zodResolver(forgotEmailSchema), defaultValues: { email: "" } });
  const otpForm = useForm({ resolver: zodResolver(otpSchema), defaultValues: { otp: "" } });
  const passwordForm = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });

  const newPassword = useWatch({ control: passwordForm.control, name: "newPassword" });

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendOtp(to: string) {
    setBusy(true);
    const result = await run(() => authService.forgotPassword(to), { success: "If this email is registered, an OTP has been sent to it" });
    setBusy(false);
    if (!result.ok) return;
    setEmail(to);
    setResendIn(result.data.resendAfterSec || 60);
    otpForm.reset({ otp: "" });
    setStep("otp");
  }

  async function verify({ otp }: { otp: string }) {
    setBusy(true);
    const result = await run(() => authService.verifyOtp(email, otp), { success: "OTP verified — set your new password" });
    setBusy(false);
    if (!result.ok) return;
    setResetToken(result.data.resetToken);
    setStep("password");
  }

  async function reset({ newPassword }: NewPasswordInput) {
    if (!resetToken) return;
    setBusy(true);
    const result = await run(() => authService.resetPassword(resetToken, newPassword), {
      success: "Password changed — please log in with your new password",
    });
    setBusy(false);
    if (result.ok) router.replace("/login");
    else if (/expired/i.test(result.message)) setStep("email");
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
        <h2 className="text-[28px] font-extrabold text-[#0F172A] tracking-tight leading-tight m-0">
          Forgot password
        </h2>
        <p className="text-sm text-slate-500 m-0">
          {step === "email" && "Enter your registered email — we'll send you an OTP."}
          {step === "otp" && (
            <>
              We sent a 6-digit OTP to <span className="font-semibold text-slate-800">{email}</span>.
            </>
          )}
          {step === "password" && "Now set your new secure password."}
        </p>
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      {/* Step 1: Email */}
      {step === "email" && (
        <form onSubmit={emailForm.handleSubmit(({ email: to }) => sendOtp(to))} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <Mail className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="fp-email"
                type="email"
                placeholder="Email address"
                autoComplete="email"
                autoFocus
                {...emailForm.register("email")}
                className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
              />
            </div>
            {emailForm.formState.errors.email?.message && (
              <span className="text-xs font-medium text-red-500 mt-0.5">{emailForm.formState.errors.email.message}</span>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {busy && <Spinner className="text-white size-4" />}
            <span>{busy ? "Sending…" : "Send OTP"}</span>
          </button>
        </form>
      )}

      {/* Step 2: OTP */}
      {step === "otp" && (
        <form onSubmit={otpForm.handleSubmit(verify)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <input
              id="fp-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              autoFocus
              className="h-12 w-full rounded-xl border border-slate-200/90 text-center font-bold tracking-[0.4em] text-lg text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
              {...otpForm.register("otp", { onChange: (e) => otpForm.setValue("otp", e.target.value.replace(/\D/g, "").slice(0, 6)) })}
            />
            {otpForm.formState.errors.otp?.message && (
              <span className="text-xs font-medium text-red-500 mt-0.5">{otpForm.formState.errors.otp.message}</span>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {busy && <Spinner className="text-white size-4" />}
            <span>{busy ? "Verifying…" : "Verify OTP"}</span>
          </button>
          <div className="flex justify-between items-center text-xs pt-1">
            <button type="button" className="font-medium text-slate-500 hover:text-slate-800 cursor-pointer" onClick={() => setStep("email")}>
              ← Change email
            </button>
            <button
              type="button"
              className="font-semibold text-[#2563EB] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 cursor-pointer"
              onClick={() => (resendIn > 0 ? toast.info(`Wait ${resendIn}s`) : sendOtp(email))}
              disabled={busy || resendIn > 0}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: New Password */}
      {step === "password" && (
        <form onSubmit={passwordForm.handleSubmit(reset)} className="flex flex-col gap-4" noValidate>
          {/* New Password */}
          <div className="group/pw relative flex flex-col gap-1.5">
            <div className="relative">
              <Lock className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="fp-new"
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                autoComplete="new-password"
                autoFocus
                {...passwordForm.register("newPassword")}
                className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {passwordForm.formState.errors.newPassword?.message && (
              <span className="text-xs font-medium text-red-500 mt-0.5">{passwordForm.formState.errors.newPassword.message}</span>
            )}
            <PasswordPopover password={newPassword} className="top-12" />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <Lock className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="fp-confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
                className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
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
            {passwordForm.formState.errors.confirmPassword?.message && (
              <span className="text-xs font-medium text-red-500 mt-0.5">{passwordForm.formState.errors.confirmPassword.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {busy && <Spinner className="text-white size-4" />}
            <span>{busy ? "Updating…" : "Update password"}</span>
          </button>
        </form>
      )}

      {/* Footer */}
      <div className="border-t border-slate-100 pt-4 text-center">
        <p className="text-sm text-slate-500 m-0">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
