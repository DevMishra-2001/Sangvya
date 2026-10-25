"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth-store";

export function SignupForm() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const password = useWatch({ control, name: "password" });

  async function onSubmit(values: SignupInput) {
    // Next step: set up the company (proxy.ts sends company-less users there)
    if (await signup(values)) router.replace("/onboarding");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>You&apos;ll set up your company next. 14-day free trial — no card needed.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Your name" htmlFor="name" error={errors.name}>
            <Input id="name" autoComplete="name" autoFocus aria-invalid={Boolean(errors.name)} {...register("name")} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </FormField>
          <FormField label="Password" htmlFor="password" error={errors.password}>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
          </FormField>
          <PasswordChecklist password={password} />
        </CardContent>
        <CardFooter className="mt-2 flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} {isSubmitting ? "Creating…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
