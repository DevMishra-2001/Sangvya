"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { PasswordChecklist } from "@/components/common/password-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/schemas/auth";
import { useAuthStore, useUser } from "@/stores/auth-store";

// Any logged-in user sets a new password for their own account. Other devices are logged out.
export function ChangePasswordView() {
  const user = useUser();
  const changePassword = useAuthStore((s) => s.changePassword);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });

  const newPassword = useWatch({ control, name: "newPassword" });

  async function onSubmit(values: NewPasswordInput) {
    if (await changePassword(values.newPassword)) reset();
  }

  return (
    <div>
      <PageHeader title="Change Password" description="Other devices you're logged in on will be signed out." />
      <Card className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Account" htmlFor="cp-account">
              <Input id="cp-account" value={`${user.name} · ${user.email}`} readOnly disabled />
            </FormField>
            <FormField label="New password" htmlFor="cp-new" error={errors.newPassword}>
              <Input id="cp-new" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...register("newPassword")} />
            </FormField>
            <PasswordChecklist password={newPassword} />
            <FormField label="Confirm password" htmlFor="cp-confirm" error={errors.confirmPassword}>
              <Input id="cp-confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
            </FormField>
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
