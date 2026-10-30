"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth-store";
import { ChangePasswordForm } from "./change-password-form";

// Only same-site paths, so ?next= can't send someone to another website
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mustChangePassword] = useState(false);

  const mode = params.get("mode");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const res = await login(values);
    if (res) {
      router.replace(safeNext(params.get("next")));
    }
  }

  if (mode === "change-password" || mustChangePassword) {
    return (
      <ChangePasswordForm
        title="Set New Password"
        subtitle="For security, please set a new personal password to continue."
        requireCurrentPassword={false}
        onSuccess={() => router.replace(safeNext(params.get("next")))}
      />
    );
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col gap-6">
      {/* Brand Logo matching reference */}
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
          <Users className="size-5 text-white" />
        </div>
        <span className="font-extrabold text-xl tracking-tight text-[#1E293B]">
          Workkind
        </span>
      </div>

      {/* Header: Welcome Back 👋 */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[32px] font-extrabold text-[#0F172A] tracking-tight leading-tight flex items-center gap-2 m-0">
          <span>Welcome Back</span>
          <span className="text-2xl">👋</span>
        </h2>
        <p className="text-sm text-slate-500 m-0">
          Sign in to your Workkind account to continue
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Email Field with Left Mail Icon */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Mail className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="email"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              autoFocus
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 aria-invalid:border-red-500"
            />
          </div>
          {errors.email?.message && (
            <span className="text-xs font-medium text-red-500 mt-0.5">{errors.email.message}</span>
          )}
        </div>

        {/* Password Field with Left Lock Icon & Right Eye Toggle (Only Icon, No Text) */}
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Lock className="size-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
              className="h-12 w-full rounded-xl border border-slate-200/90 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 bg-white shadow-xs outline-none transition-all focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 aria-invalid:border-red-500"
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
          {errors.password?.message && (
            <span className="text-xs font-medium text-red-500 mt-0.5">{errors.password.message}</span>
          )}
        </div>

        {/* Remember me & Forgot password row */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/20 cursor-pointer accent-[#2563EB]"
            />
            <span>Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Blue Gradient Login Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting ? (
            <>
              <Spinner className="text-white size-4" />
              <span>Logging in…</span>
            </>
          ) : (
            <>
              <span>Login</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
