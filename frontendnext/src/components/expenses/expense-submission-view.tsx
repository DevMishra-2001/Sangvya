"use client";

// Expense Submission: general details of the trip, then each kind of expense in its own section with a total
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { ArrowLeft, Building, ChevronDown, ChevronUp, Coffee, Gift, Info, MoreHorizontal, Plane, Plus, Receipt, Save, Send, Trash2, Car } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid, FormHeading } from "@/components/common/form-layout";
import { LocationFields } from "@/components/common/location-fields";
import { NotLinkedState } from "@/components/common/empty-state";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { fmtDate, inr, isoDate } from "@/lib/format";
import { expensesService, type Attachment, type ClaimDetail, type TravelType } from "@/lib/services/expenses";
import { cn } from "@/lib/utils";
import { useUser } from "@/stores/auth-store";
import { BillPicker } from "./expense-shared";

const TRAVEL: { value: TravelType; label: string }[] = [
  { value: "cab", label: "Cab" },
  { value: "auto", label: "Auto" },
  { value: "bus", label: "Bus" },
  { value: "metro", label: "Metro" },
  { value: "train", label: "Train" },
  { value: "flight", label: "Flight" },
  { value: "own_car", label: "Own car" },
  { value: "own_bike", label: "Own bike" },
  { value: "other", label: "Other" },
];

type Line = { travelType: TravelType; from: string; to: string; amount: string; description: string };
const newLine = (): Line => ({ travelType: "cab", from: "", to: "", amount: "", description: "" });

interface Values {
  claimDate: string;
  tripName: string;
  country: string;
  state: string;
  city: string;
  locality: string;
  clientName: string;
  teammates: string;
  expenseType: string;
  hotelAmount: string;
  hotelName: string;
  hotelDescription: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  mealsDescription: string;
  localTravel: Line[];
  intercityTravel: Line[];
  entertainmentAmount: string;
  entertainmentDescription: string;
  otherAmount: string;
  otherDescription: string;
}

const EMPTY: Values = {
  claimDate: "",
  tripName: "",
  country: "India",
  state: "",
  city: "",
  locality: "",
  clientName: "",
  teammates: "",
  expenseType: "domestic",
  hotelAmount: "",
  hotelName: "",
  hotelDescription: "",
  breakfast: "",
  lunch: "",
  dinner: "",
  mealsDescription: "",
  localTravel: [newLine()],
  intercityTravel: [newLine()],
  entertainmentAmount: "",
  entertainmentDescription: "",
  otherAmount: "",
  otherDescription: "",
};

const num = (v: string | undefined) => Number(v) || 0;
// "1200.00" → "1200"; zero stays empty so the placeholder shows
const str = (v: string | number | null | undefined) => (v == null || Number(v) === 0 ? "" : String(Number(v)));

function fromDetail(d: ClaimDetail): Values {
  const c = d.claim;
  const line = (l: ClaimDetail["localTravel"][number]): Line => ({ travelType: l.travel_type, from: l.from_place ?? "", to: l.to_place ?? "", amount: String(Number(l.amount)), description: l.description ?? "" });
  return {
    claimDate: c.claim_date,
    tripName: c.trip_name,
    country: c.country ?? "",
    state: c.state ?? "",
    city: c.city ?? "",
    locality: c.locality ?? "",
    clientName: c.client_name ?? "",
    teammates: c.teammates ?? "",
    expenseType: c.expense_type,
    hotelAmount: str(c.hotel_amount),
    hotelName: c.hotel_name ?? "",
    hotelDescription: c.hotel_description ?? "",
    breakfast: str(c.breakfast),
    lunch: str(c.lunch),
    dinner: str(c.dinner),
    mealsDescription: c.meals_description ?? "",
    localTravel: d.localTravel.length ? d.localTravel.map(line) : [newLine()],
    intercityTravel: d.intercityTravel.length ? d.intercityTravel.map(line) : [newLine()],
    entertainmentAmount: str(c.entertainment_amount),
    entertainmentDescription: c.entertainment_description ?? "",
    otherAmount: str(c.other_amount),
    otherDescription: c.other_description ?? "",
  };
}

// A section: icon + title on the left, its total and a collapse arrow on the right
function Section({ icon: Icon, title, total, children, onClear }: { icon: typeof Building; title: string; total: number; children: React.ReactNode; onClear?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Icon className="size-3.5 text-primary" />
        <h3 className="text-[13px] font-medium">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Total : <span className="font-semibold text-foreground tabular-nums">{inr(total)}</span>
        </span>
        {onClear && (
          <Button type="button" variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => setOpen((o) => !o)} aria-label={open ? `Hide ${title}` : `Show ${title}`}>
          {open ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

function TravelRows({ control, name, register, setValue }: { control: Control<Values>; name: "localTravel" | "intercityTravel"; register: ReturnType<typeof useForm<Values>>["register"]; setValue: ReturnType<typeof useForm<Values>>["setValue"] }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const rows = useWatch({ control, name });
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[9rem_1fr_1fr_8rem_1.2fr_5rem] gap-2 rounded-t-md border bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground">
          <span>Travel Type</span>
          <span>From</span>
          <span>To</span>
          <span>Amount</span>
          <span>Description</span>
          <span>Add/Remove</span>
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[9rem_1fr_1fr_8rem_1.2fr_5rem] items-center gap-2 border-x border-b px-2 py-1 last:rounded-b-md">
            <SelectField
              size="sm"
              value={rows?.[i]?.travelType ?? "cab"}
              onValueChange={(v) => setValue(`${name}.${i}.travelType`, v as TravelType)}
              options={TRAVEL}
              aria-label="Travel type"
            />
            <Input className="h-8" placeholder="From" {...register(`${name}.${i}.from`)} />
            <Input className="h-8" placeholder="To" {...register(`${name}.${i}.to`)} />
            <Input className="h-8" type="number" min={0} placeholder="Amount" {...register(`${name}.${i}.amount`)} />
            <Input className="h-8" placeholder="Description" {...register(`${name}.${i}.description`)} />
            <span className="flex gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Add row" className="text-success" onClick={() => append(newLine())}>
                <Plus />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove row" className="text-destructive" onClick={() => (fields.length > 1 ? remove(i) : undefined)} disabled={fields.length === 1}>
                <Trash2 />
              </Button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpenseSubmissionView() {
  const user = useUser();
  const router = useRouter();
  const url = useUrlParams();
  const editId = url.getNumber("id", 0) || null;
  const { register, control, handleSubmit, reset, setValue, getValues } = useForm<Values>({ defaultValues: EMPTY });
  const v = useWatch({ control });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [last, setLast] = useState<ClaimDetail["claim"] | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [travelKey, setTravelKey] = useState(0);

  // Editing: load the claim; new: today's date and the last expense for the header
  useEffect(() => {
    if (!user.employee_id) return;
    let cancelled = false;
    if (editId) {
      run(() => expensesService.claim(editId)).then((r) => {
        if (cancelled) return;
        setLoading(false);
        if (!r.ok) return;
        if (!r.data.can.edit) {
          router.replace(`/expenses`);
          return;
        }
        reset(fromDetail(r.data));
        setFiles(r.data.claim.attachments);
        setTravelKey((k) => k + 1);
      });
    } else {
      queueMicrotask(() => setValue("claimDate", isoDate(new Date())));
    }
    run(() => expensesService.list({ kind: "claims", scope: "mine", limit: 1 }), { silent: true }).then(async (r) => {
      if (cancelled || !r.ok || !r.data.rows[0]) return;
      const d = await run(() => expensesService.claim(r.data.rows[0].id), { silent: true });
      if (!cancelled && d.ok) setLast(d.data.claim);
    });
    return () => {
      cancelled = true;
    };
  }, [user.employee_id, editId, reset, setValue, router]);

  if (!user.employee_id) return <NotLinkedState />;

  const local = (v.localTravel ?? []).reduce((t, l) => t + num(l?.amount), 0);
  const intercity = (v.intercityTravel ?? []).reduce((t, l) => t + num(l?.amount), 0);
  const meals = num(v.breakfast) + num(v.lunch) + num(v.dinner);
  const grand = num(v.hotelAmount) + meals + local + intercity + num(v.entertainmentAmount) + num(v.otherAmount);

  async function save(values: Values, submit: boolean) {
    setBusy(submit ? "submit" : "save");
    const line = (l: Line) => ({ travelType: l.travelType, from: l.from || null, to: l.to || null, amount: num(l.amount), description: l.description || null });
    const body = {
      ...values,
      hotelAmount: num(values.hotelAmount),
      breakfast: num(values.breakfast),
      lunch: num(values.lunch),
      dinner: num(values.dinner),
      entertainmentAmount: num(values.entertainmentAmount),
      otherAmount: num(values.otherAmount),
      localTravel: values.localTravel.filter((l) => num(l.amount) > 0 || l.from || l.to).map(line),
      intercityTravel: values.intercityTravel.filter((l) => num(l.amount) > 0 || l.from || l.to).map(line),
      attachments: files,
      submit,
    };
    const r = await run(() => (editId ? expensesService.updateClaim(editId, body) : expensesService.createClaim(body)), { success: submit ? "Expense submitted for approval" : "Saved as draft" });
    setBusy(null);
    if (!r.ok) return;
    if (submit) router.push("/expenses");
    else if (!editId) url.set({ id: r.data.claim.id });
  }

  const clear = (...keys: (keyof Values)[]) => keys.forEach((k) => setValue(k, "" as never));

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <form onSubmit={handleSubmit((x) => save(x, true))} noValidate className="flex flex-col gap-4">
      <FormCard
        title={editId ? `Expense #${editId}` : "Expense Submission"}
       
        icon={Receipt}
        actions={
          <>
            {last && (
              <span className="hidden flex-wrap items-center gap-x-2 text-xs xl:flex">
                <span className="font-semibold">Last Expense Date :</span> <span className="text-destructive">{fmtDate(last.claim_date)}</span> |<span className="font-semibold">Trip Name:</span> <span className="text-destructive">{last.trip_name}</span>
                {last.state && (
                  <>
                    | <span className="font-semibold">State:</span> <span className="text-destructive">{last.state}</span>
                  </>
                )}
                {last.city && (
                  <>
                    | <span className="font-semibold">City:</span> <span className="text-destructive">{last.city}</span>
                  </>
                )}
                {last.locality && (
                  <>
                    | <span className="font-semibold">Locality:</span> <span className="text-destructive">{last.locality}</span>
                  </>
                )}
                {last.client_name && (
                  <>
                    | <span className="font-semibold">Client Name:</span> <span className="text-destructive">{last.client_name}</span>
                  </>
                )}
              </span>
            )}
            <Button asChild size="sm">
              <Link href="/expenses">
                <ArrowLeft /> Back to List
              </Link>
            </Button>
          </>
        }
      >
        <FormGrid>
          <FieldSeparator label="General Details" />
          <FormField label="Date" htmlFor="ex-date" required>
            <DatePicker id="ex-date" value={v.claimDate ?? ""} onChange={(d) => setValue("claimDate", d)} max={isoDate(new Date())} />
          </FormField>
          <FormField label="Trip Name" htmlFor="ex-trip" required>
            <Input id="ex-trip" {...register("tripName")} maxLength={150} />
          </FormField>
          <LocationFields control={control as unknown as Control<Record<string, string>>} idPrefix="ex" />
          <FormField label="Locality" htmlFor="ex-loc">
            <Input id="ex-loc" {...register("locality")} />
          </FormField>
          <FormField label="Client Name" htmlFor="ex-client">
            <Input id="ex-client" {...register("clientName")} />
          </FormField>
          <FormField label="Teammates Name" htmlFor="ex-team">
            <Input id="ex-team" {...register("teammates")} placeholder="Comma separated" />
          </FormField>
          <FormField label="Expense Type" htmlFor="ex-type">
            <SelectField
              id="ex-type"
              value={v.expenseType ?? "domestic"}
              onValueChange={(x) => setValue("expenseType", x)}
              options={[
                { value: "domestic", label: "Domestic" },
                { value: "international", label: "International" },
              ]}
            />
          </FormField>
        </FormGrid>
      </FormCard>

      <section className="overflow-hidden rounded-xl border bg-card">
        <FormHeading title="Expense Details" actions={<span className="text-[13px] font-semibold tabular-nums">Grand Total : {inr(grand)}</span>} />

        <Section icon={Building} title="Hotel Expense" total={num(v.hotelAmount)} onClear={() => clear("hotelAmount", "hotelName", "hotelDescription")}>
          <div className="grid gap-2 sm:grid-cols-3 [&_input]:h-8">
            <Input type="number" min={0} placeholder="Hotel Amount" aria-label="Hotel amount" {...register("hotelAmount")} />
            <Input placeholder="Hotel Name" aria-label="Hotel name" {...register("hotelName")} />
            <Input placeholder="Description" aria-label="Hotel description" {...register("hotelDescription")} />
          </div>
        </Section>

        <Section icon={Coffee} title="Meals Expense" total={meals} onClear={() => clear("breakfast", "lunch", "dinner", "mealsDescription")}>
          <div className="grid gap-2 sm:grid-cols-4 [&_input]:h-8">
            <Input type="number" min={0} placeholder="Breakfast Amount" aria-label="Breakfast" {...register("breakfast")} />
            <Input type="number" min={0} placeholder="Lunch Amount" aria-label="Lunch" {...register("lunch")} />
            <Input type="number" min={0} placeholder="Dinner Amount" aria-label="Dinner" {...register("dinner")} />
            <Input placeholder="Description" aria-label="Meals description" {...register("mealsDescription")} />
          </div>
        </Section>

        <Section icon={Car} title="Local Travel Expense" total={local}>
          <TravelRows key={`l${travelKey}`} control={control} name="localTravel" register={register} setValue={setValue} />
        </Section>

        <Section icon={Plane} title="Inter City Travel Expense" total={intercity}>
          <TravelRows key={`i${travelKey}`} control={control} name="intercityTravel" register={register} setValue={setValue} />
        </Section>

        <Section icon={Gift} title="Client Entertainment Expense" total={num(v.entertainmentAmount)} onClear={() => clear("entertainmentAmount", "entertainmentDescription")}>
          <div className="grid gap-2 sm:grid-cols-3 [&_input]:h-8">
            <Input type="number" min={0} placeholder="Entertainment Amount" aria-label="Entertainment amount" {...register("entertainmentAmount")} />
            <Input className="sm:col-span-2" placeholder="Entertainment Description" aria-label="Entertainment description" {...register("entertainmentDescription")} />
          </div>
        </Section>

        <Section icon={MoreHorizontal} title="Other Expense" total={num(v.otherAmount)} onClear={() => clear("otherAmount", "otherDescription")}>
          <div className="grid gap-2 sm:grid-cols-3 [&_input]:h-8">
            <Input type="number" min={0} placeholder="Other Amount" aria-label="Other amount" {...register("otherAmount")} />
            <Input className="sm:col-span-2" placeholder="Other Description" aria-label="Other description" {...register("otherDescription")} />
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <BillPicker files={files} onChange={setFiles} />
          <span className="flex-1" />
          <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", grand > 0 && "hidden")}>
            <Info className="size-3.5" /> Enter at least one amount
          </span>
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => save(getValues(), false)}>
            {busy === "save" ? <Spinner /> : <Save />} Save draft
          </Button>
          <Button type="submit" disabled={busy !== null || grand <= 0 || !(v.tripName ?? "").trim()}>
            {busy === "submit" ? <Spinner /> : <Send />} Submit
          </Button>
        </div>
      </section>
    </form>
  );
}
