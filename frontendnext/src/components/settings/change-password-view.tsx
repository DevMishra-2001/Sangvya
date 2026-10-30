"use client";

import { KeyRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { PasswordInput } from "@/components/common/password-input";
import { PageHeader } from "@/components/common/page-header";
import { PasswordHint } from "@/components/common/password-hint";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Change Password" description="Other devices you're logged in on will be signed out." className="mb-0" />
      <FormCard title="Change Password" crumbs={["Master"]} icon={KeyRound}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormGrid>
            <FormField label="Employee" htmlFor="cp-account">
              <Input id="cp-account" value={user.name} title={user.email} readOnly disabled />
            </FormField>
            <FormField label="New password" htmlFor="cp-new" error={errors.newPassword}>
              <PasswordHint password={newPassword}>
                <PasswordInput id="cp-new" autoComplete="new-password" aria-invalid={Boolean(errors.newPassword)} {...register("newPassword")} />
              </PasswordHint>
            </FormField>
            <FormField label="Confirm password" htmlFor="cp-confirm" error={errors.confirmPassword}>
              <PasswordInput id="cp-confirm" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
            </FormField>
            <FormActions>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating…" : "Update"}
              </Button>
            </FormActions>
          </FormGrid>
        </form>
      </FormCard>
    </div>
  );
}
