"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth-store";

// Only same-site paths, so ?next= can't send someone to another website
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    if (await login(values)) router.replace(safeNext(params.get("next")));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Welcome back — sign in to your company account.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={Boolean(errors.email)} {...register("email")} />
          </FormField>
          <FormField label="Password" htmlFor="password" error={errors.password}>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          </FormField>
          <Link href="/forgot-password" className="-mt-2 self-end text-xs text-primary hover:underline">
            Forgot your password?
          </Link>
        </CardContent>
        <CardFooter className="mt-2 flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">No account? Ask your Sangvya administrator for a login.</p>
        </CardFooter>
      </form>
    </Card>
  );
}
