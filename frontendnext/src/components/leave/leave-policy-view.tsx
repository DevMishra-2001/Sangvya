"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/common/form-field";
import { FormActions, FormCard, FormGrid } from "@/components/common/form-layout";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { run } from "@/lib/api/run";
import { leavePolicySchema, type LeavePolicyForm, type LeavePolicyInput } from "@/lib/schemas/leave";
import { leavesService } from "@/lib/services/leaves";

const FIELDS = [
  { key: "clPerYear", api: "cl_per_year", label: "CL per year", max: 365, hint: "Casual leave — unused days lapse at the end of the financial year (31 March)." },
  { key: "slPerYear", api: "sl_per_year", label: "SL per year", max: 365, hint: "Sick leave — unused days carry forward to the next year." },
  { key: "olPerYear", api: "ol_per_year", label: "OL per year (default)", max: 365, hint: "Optional leave — default for everyone; set a different number per employee on the Employees page." },
  { key: "elPerMonth", api: "el_per_month", label: "EL per month", max: 31, hint: "Earned leave — unused days at month end are paid out." },
] as const;

// Company leave quotas used for every employee's balance
export function LeavePolicyView() {
  const [loaded, setLoaded] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeavePolicyForm, unknown, LeavePolicyInput>({ resolver: zodResolver(leavePolicySchema) });

  useEffect(() => {
    run(leavesService.policy).then((r) => {
      if (!r.ok) return;
      reset(Object.fromEntries(FIELDS.map((f) => [f.key, String(r.data[f.api])])) as LeavePolicyForm);
      setLoaded(true);
    });
  }, [reset]);

  async function onSubmit(values: LeavePolicyInput) {
    await run(() => leavesService.savePolicy(values), { success: "Leave policy saved" });
  }

  return (
    <div>
      <PageHeader title="Leave Policy" description="Leave quotas for the whole company. The leave year runs 1 April – 31 March." />
      {!loaded ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <FormCard title="Leave quotas" crumbs={["Master", "Leave Policy"]} icon={Scale}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormGrid>
              {FIELDS.map((f) => (
                <FormField key={f.key} label={f.label} htmlFor={f.key} error={errors[f.key]} description={f.hint}>
                  <Input id={f.key} type="number" min={0} max={f.max} step={0.5} {...register(f.key)} />
                </FormField>
              ))}
              <FormActions>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save policy"}
                </Button>
              </FormActions>
            </FormGrid>
          </form>
        </FormCard>
      )}
    </div>
  );
}
