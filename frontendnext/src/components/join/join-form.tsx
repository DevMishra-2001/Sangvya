"use client";

// Public self-onboarding: the employee fills their own details and uploads documents (no login, token link)
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Circle, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { FormDatePicker } from "@/components/common/date-picker";
import { FileUpload } from "@/components/common/file-upload";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid } from "@/components/common/form-layout";
import { FormSelect } from "@/components/common/select-field";
import { ForceLight } from "@/components/layout/force-light";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { run } from "@/lib/api/run";
import { INDIAN_STATES } from "@/lib/company-rules";
import {
  ACCOUNT_TYPE_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  DOCUMENT_CATEGORY_LABELS,
  GENDER_OPTIONS,
  JOINING_DOCUMENTS,
  MARITAL_STATUS_OPTIONS,
  RELATION_OPTIONS,
} from "@/lib/constants";
import { fmtDate, fmtDateTime, isoDate } from "@/lib/format";
import { privateFields, selfFields } from "@/lib/schemas/employee";
import { onboardingService } from "@/lib/services/onboarding";
import type { DocumentCategory, OnboardingForm } from "@/lib/types";
import { cn } from "@/lib/utils";

const joinSchema = z.object({ ...selfFields, ...privateFields }).transform(({ pan, aadhaar, uan, pfNumber, esiNumber, passportNumber, bankName, bankBranch, ifsc, accountNumber, accountHolder, accountType, ...details }) => ({
  ...details,
  private: { pan, aadhaar, uan, pfNumber, esiNumber, passportNumber, bankName, bankBranch, ifsc, accountNumber, accountHolder, accountType },
}));
type JoinValues = z.input<typeof joinSchema>;
type JoinPayload = z.output<typeof joinSchema>;

const DETAIL_KEYS = Object.keys(selfFields) as (keyof typeof selfFields)[];
const blankPrivate = Object.fromEntries(Object.keys(privateFields).map((k) => [k, ""])) as Record<keyof typeof privateFields, string>;

// Snake-case "on file" keys for each private field
const ON_FILE: Record<string, string> = { pan: "pan", aadhaar: "aadhaar", uan: "uan", pfNumber: "pf_number", esiNumber: "esi_number", passportNumber: "passport_number", ifsc: "ifsc", accountNumber: "account_number" };

export function JoinForm({ token }: { token: string }) {
  const [data, setData] = useState<OnboardingForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("pan_card");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JoinValues, unknown, JoinPayload>({ resolver: zodResolver(joinSchema) });

  useEffect(() => {
    let cancelled = false;
    onboardingService
      .open(token)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        const details = Object.fromEntries(DETAIL_KEYS.map((k) => [k, d.details[k] ?? ""])) as Record<string, string>;
        if (!details.nationality) details.nationality = "Indian";
        if (!details.country) details.country = "India";
        reset({ ...details, ...blankPrivate } as JoinValues);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [token, reset]);

  async function reload() {
    const r = await run(() => onboardingService.open(token), { silent: true });
    if (r.ok) setData(r.data);
  }

  async function save(payload: JoinPayload) {
    await run(() => onboardingService.save(token, payload), { success: "Saved — you can come back and finish later" });
  }

  async function submit(payload: JoinPayload) {
    setSubmitting(true);
    const saved = await run(() => onboardingService.save(token, payload));
    const sent = saved.ok && (await run(() => onboardingService.submit(token))).ok;
    setSubmitting(false);
    if (sent) setDone(true);
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <ForceLight />
      <div className="mx-auto flex max-w-5xl flex-col gap-5">{children}</div>
    </main>
  );

  if (error) {
    return shell(
      <section className="rounded-xl border bg-white p-10 text-center">
        <h1 className="text-lg font-semibold">This link can&apos;t be opened</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </section>,
    );
  }
  if (!data) return shell(<Skeleton className="h-96 w-full rounded-xl" />);
  if (done) {
    return shell(
      <section className="flex flex-col items-center gap-2 rounded-xl border bg-white p-10 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <h1 className="text-lg font-semibold">Thanks, {data.employee.name.split(" ")[0]}!</h1>
        <p className="text-sm text-muted-foreground">Your details were sent to HR at {data.company?.name}. You can close this page.</p>
      </section>,
    );
  }

  const have = new Set(data.documents.map((d) => d.category));
  const onFile = (key: string) => data.privateOnFile[ON_FILE[key] ?? key];
  const keepHint = (key: string) => (onFile(key) ? "Already on file — leave empty to keep" : undefined);
  const none = "— Select —";

  return shell(
    <>
      <header className="flex items-center gap-4">
        {data.company?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- company logo from ImageKit
          <img src={data.company.logo_url} alt="" className="size-14 rounded-xl border bg-white object-contain p-1" />
        )}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Welcome to {data.company?.name}</h1>
          <p className="text-sm text-slate-500">
            {data.employee.name}
            {data.employee.designation && ` · ${data.employee.designation}`}
            {data.employee.join_date && ` · joining ${fmtDate(data.employee.join_date)}`}
          </p>
        </div>
      </header>
      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-slate-700">
        Fill in your details and upload your documents. Save any time and come back — this link works until {fmtDateTime(data.expiresAt)}. Press <strong>Submit to HR</strong> when you&apos;re done.
      </p>

      <form noValidate autoComplete="off" onSubmit={handleSubmit(submit)}>
        <FormCard title="Your details" crumbs={["Joining form"]} className="bg-white">
          <FormGrid>
            <FieldSeparator label="Personal" />
            <FormField label="Phone" htmlFor="j-phone" error={errors.phone}>
              <Input id="j-phone" type="tel" inputMode="tel" maxLength={18} placeholder="98765 43210" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
            </FormField>
            <FormField label="Personal email" htmlFor="j-pemail" error={errors.personalEmail}>
              <Input id="j-pemail" type="email" {...register("personalEmail")} />
            </FormField>
            <FormField label="Date of birth" htmlFor="j-dob" error={errors.dateOfBirth}>
              <FormDatePicker control={control} name="dateOfBirth" id="j-dob" max={isoDate(new Date())} dropdowns clearable />
            </FormField>
            <FormField label="Gender" htmlFor="j-gender" error={errors.gender}>
              <FormSelect control={control} name="gender" id="j-gender" emptyLabel={none} options={GENDER_OPTIONS} />
            </FormField>
            <FormField label="Marital status" htmlFor="j-marital" error={errors.maritalStatus}>
              <FormSelect control={control} name="maritalStatus" id="j-marital" emptyLabel={none} options={MARITAL_STATUS_OPTIONS} />
            </FormField>
            <FormField label="Blood group" htmlFor="j-blood" error={errors.bloodGroup}>
              <FormSelect control={control} name="bloodGroup" id="j-blood" emptyLabel={none} options={BLOOD_GROUP_OPTIONS} />
            </FormField>
            <FormField label="Nationality" htmlFor="j-nation" error={errors.nationality}>
              <Input id="j-nation" {...register("nationality")} />
            </FormField>

            <FieldSeparator label="Address" />
            <FormField label="Address line 1" htmlFor="j-a1" error={errors.address} span="md">
              <Input id="j-a1" placeholder="House, street" {...register("address")} />
            </FormField>
            <FormField label="Address line 2" htmlFor="j-a2" error={errors.addressLine2} span="md">
              <Input id="j-a2" placeholder="Area, landmark" {...register("addressLine2")} />
            </FormField>
            <FormField label="City" htmlFor="j-city" error={errors.city}>
              <Input id="j-city" {...register("city")} />
            </FormField>
            <FormField label="State" htmlFor="j-state" error={errors.state}>
              <Input id="j-state" list="j-states" {...register("state")} />
              <datalist id="j-states">
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FormField>
            <FormField label="Pincode" htmlFor="j-pin" error={errors.postalCode}>
              <Input id="j-pin" inputMode="numeric" maxLength={10} {...register("postalCode")} />
            </FormField>
            <FormField label="Country" htmlFor="j-country" error={errors.country}>
              <Input id="j-country" {...register("country")} />
            </FormField>

            <FieldSeparator label="Emergency contact" />
            <FormField label="Contact name" htmlFor="j-ecn" error={errors.emergencyContactName}>
              <Input id="j-ecn" {...register("emergencyContactName")} />
            </FormField>
            <FormField label="Relationship" htmlFor="j-ecr" error={errors.emergencyContactRelation}>
              <FormSelect control={control} name="emergencyContactRelation" id="j-ecr" emptyLabel={none} options={RELATION_OPTIONS} />
            </FormField>
            <FormField label="Phone" htmlFor="j-ecp" error={errors.emergencyContactPhone}>
              <Input id="j-ecp" type="tel" inputMode="tel" maxLength={18} placeholder="98765 43210" aria-invalid={Boolean(errors.emergencyContactPhone)} {...register("emergencyContactPhone")} />
            </FormField>

            <FieldSeparator label="ID numbers" />
            <FormField label="PAN" htmlFor="j-pan" error={errors.pan} description={keepHint("pan")}>
              <Input id="j-pan" maxLength={10} placeholder="ABCPE1234F" className="uppercase" {...register("pan")} />
            </FormField>
            <FormField label="Aadhaar" htmlFor="j-aadhaar" error={errors.aadhaar} description={keepHint("aadhaar")}>
              <Input id="j-aadhaar" inputMode="numeric" maxLength={14} placeholder="1234 5678 9012" {...register("aadhaar")} />
            </FormField>
            <FormField label="UAN (if you had PF before)" htmlFor="j-uan" error={errors.uan} description={keepHint("uan")}>
              <Input id="j-uan" inputMode="numeric" maxLength={12} {...register("uan")} />
            </FormField>
            <FormField label="Passport number" htmlFor="j-passport" error={errors.passportNumber} description={keepHint("passportNumber")}>
              <Input id="j-passport" maxLength={20} className="uppercase" {...register("passportNumber")} />
            </FormField>

            <FieldSeparator label="Bank account (for salary)" />
            <FormField label="Account holder" htmlFor="j-holder" error={errors.accountHolder}>
              <Input id="j-holder" placeholder="As in the bank" {...register("accountHolder")} />
            </FormField>
            <FormField label="Account number" htmlFor="j-acc" error={errors.accountNumber} description={keepHint("accountNumber")}>
              <Input id="j-acc" inputMode="numeric" maxLength={22} {...register("accountNumber")} />
            </FormField>
            <FormField label="IFSC" htmlFor="j-ifsc" error={errors.ifsc} description={keepHint("ifsc")}>
              <Input id="j-ifsc" maxLength={11} placeholder="SBIN0001234" className="uppercase" {...register("ifsc")} />
            </FormField>
            <FormField label="Bank name" htmlFor="j-bank" error={errors.bankName}>
              <Input id="j-bank" {...register("bankName")} />
            </FormField>
            <FormField label="Branch" htmlFor="j-branch" error={errors.bankBranch}>
              <Input id="j-branch" {...register("bankBranch")} />
            </FormField>
            <FormField label="Account type" htmlFor="j-acc-type" error={errors.accountType}>
              <FormSelect control={control} name="accountType" id="j-acc-type" emptyLabel={none} options={ACCOUNT_TYPE_OPTIONS} />
            </FormField>

            <FieldSeparator label="Documents" />
            <ul className="col-span-12 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {JOINING_DOCUMENTS.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary", category === c && "border-primary bg-primary/5")}
                  >
                    {have.has(c) ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                    {DOCUMENT_CATEGORY_LABELS[c]}
                  </button>
                </li>
              ))}
            </ul>
            <div className="col-span-12 lg:col-span-6">
              <FileUpload
                accept="document"
                title={`Upload ${DOCUMENT_CATEGORY_LABELS[category]}`}
                upload={async (file, onProgress) => {
                  await onboardingService.upload(token, file, category, onProgress);
                  toast.success(`${DOCUMENT_CATEGORY_LABELS[category]} uploaded`);
                  await reload();
                }}
              />
            </div>
            {data.documents.length > 0 && (
              <ul className="col-span-12 flex flex-wrap gap-2">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <Badge variant="outline" className="font-normal">
                      {DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category}: {d.file_name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </FormGrid>
        </FormCard>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="lg" disabled={isSubmitting || submitting} onClick={handleSubmit(save)}>
            <Save /> Save for later
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting || submitting}>
            {submitting ? <Spinner /> : <Send />} Submit to HR
          </Button>
        </div>
      </form>
    </>,
  );
}
