"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <ol className="mb-2 flex items-center" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
                  done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : <s.Icon className="size-4" />}
              </span>
              <span className={cn("text-xs whitespace-nowrap", active ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cn("mx-2 mb-5 h-0.5 flex-1 rounded", done ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

// Logged-out flow: email → OTP (emailed) → new password → back to login.
export function ForgotPasswordFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);

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
    else if (/expired/i.test(result.message)) setStep("email"); // reset window over → start again
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          {step === "email" && "Enter your registered email — we'll send you an OTP."}
          {step === "otp" && (
            <>
              We sent a 6-digit OTP to <span className="font-medium text-foreground">{email}</span>.
            </>
          )}
          {step === "password" && "Now set your new password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Stepper step={step} />

        {step === "email" && (
          <form onSubmit={emailForm.handleSubmit(({ email: to }) => sendOtp(to))} className="flex flex-col gap-4" noValidate>
            <FormField label="Email" htmlFor="fp-email" error={emailForm.formState.errors.email}>
              <Input id="fp-email" type="email" autoComplete="email" autoFocus {...emailForm.register("email")} />
            </FormField>
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Spinner />} {busy ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={otpForm.handleSubmit(verify)} className="flex flex-col gap-4" noValidate>
            <FormField label="OTP" htmlFor="fp-otp" error={otpForm.formState.errors.otp}>
              <Input
                id="fp-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                className="text-center font-semibold tracking-[0.5em]"
                {...otpForm.register("otp", { onChange: (e) => otpForm.setValue("otp", e.target.value.replace(/\D/g, "").slice(0, 6)) })}
              />
            </FormField>
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Spinner />} {busy ? "Verifying…" : "Verify OTP"}
            </Button>
            <div className="flex justify-between text-xs">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("email")}>
                ← Change email
              </button>
              <button
                type="button"
                className="text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
                onClick={() => (resendIn > 0 ? toast.info(`Wait ${resendIn}s`) : sendOtp(email))}
                disabled={busy || resendIn > 0}
              >
                {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={passwordForm.handleSubmit(reset)} className="flex flex-col gap-4" noValidate>
            <FormField label="New password" htmlFor="fp-new" error={passwordForm.formState.errors.newPassword}>
              <Input id="fp-new" type="password" autoComplete="new-password" autoFocus {...passwordForm.register("newPassword")} />
            </FormField>
            <PasswordChecklist password={newPassword} />
            <FormField label="Confirm password" htmlFor="fp-confirm" error={passwordForm.formState.errors.confirmPassword}>
              <Input id="fp-confirm" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
            </FormField>
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Spinner />} {busy ? "Changing…" : "Change password"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
