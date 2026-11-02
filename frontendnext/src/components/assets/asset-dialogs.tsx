"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker, FormDatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import { FORM_DIALOG, FormGrid } from "@/components/common/form-layout";
import { FormSelect, SelectField } from "@/components/common/select-field";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { isoDate, fmtDate } from "@/lib/format";
import { optionalDate, optionalId, optionalNumber, optionalText, requiredText } from "@/lib/schemas/common";
import { branchesService } from "@/lib/services/branches";
import { ASSET_CATEGORY_LABELS, ASSET_CONDITION_LABELS, assetsService, type Asset, type AssetCondition, type AssetHistoryRow } from "@/lib/services/assets";
import type { Branch, Id } from "@/lib/types";
import { useEmployeesStore } from "@/stores/employees-store";

const opts = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({
    value,
    label,
  }));
export const CATEGORY_OPTIONS = opts(ASSET_CATEGORY_LABELS);
const CONDITION_OPTIONS = opts(ASSET_CONDITION_LABELS);

const assetSchema = z.object({
  assetCode: optionalText(30),
  name: requiredText("Asset name is required", 150),
  category: z.string().min(1, "Pick a category"),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(100),
  purchaseDate: optionalDate,
  purchaseCost: optionalNumber("Cost must be a positive number", { min: 0 }),
  warrantyUntil: optionalDate,
  condition: z.string(),
  branchId: optionalId,
  notes: optionalText(1000),
});
type AssetForm = z.input<typeof assetSchema>;
type AssetOut = z.output<typeof assetSchema>;

const toForm = (a: Asset | null): AssetForm => ({
  assetCode: a?.asset_code ?? "",
  name: a?.name ?? "",
  category: a?.category ?? "laptop",
  brand: a?.brand ?? "",
  model: a?.model ?? "",
  serialNumber: a?.serial_number ?? "",
  purchaseDate: a?.purchase_date ?? "",
  purchaseCost: a?.purchase_cost ?? "",
  warrantyUntil: a?.warranty_until ?? "",
  condition: a?.condition ?? "new",
  branchId: a?.branch_id ? String(a.branch_id) : "",
  notes: a?.notes ?? "",
});

// Add or edit an asset
export function AssetFormDialog({ open, onOpenChange, asset, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; asset: Asset | null; onSaved: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssetForm, unknown, AssetOut>({
    resolver: zodResolver(assetSchema),
    defaultValues: toForm(asset),
  });

  useEffect(() => {
    if (!open) return;
    reset(toForm(asset));
    run(branchesService.list, { silent: true }).then((r) => r.ok && setBranches(r.data));
  }, [open, asset, reset]);

  async function onSubmit(v: AssetOut) {
    const body = {
      ...v,
      category: v.category as Asset["category"],
      condition: v.condition as AssetCondition,
    };
    const r = await run(() => (asset ? assetsService.update(asset.id, body) : assetsService.create(body)), { success: asset ? "Asset updated" : "Asset added" });
    if (!r.ok) return;
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>{asset ? `Edit ${asset.asset_code}` : "Add asset"}</DialogTitle>
        </DialogHeader>
        <form id="asset-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Asset name" htmlFor="as-name" error={errors.name} required>
              <Input id="as-name" autoFocus placeholder="e.g. MacBook Air 13" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Category" htmlFor="as-cat" error={errors.category} required>
              <FormSelect control={control} name="category" id="as-cat" options={CATEGORY_OPTIONS} />
            </FormField>
            <FormField label="Asset code" htmlFor="as-code" error={errors.assetCode} description={asset ? undefined : "Empty = next free code (AST-0001…)"}>
              <Input id="as-code" maxLength={30} className="uppercase" {...register("assetCode")} />
            </FormField>
            <FormField label="Serial number" htmlFor="as-serial" error={errors.serialNumber}>
              <Input id="as-serial" {...register("serialNumber")} />
            </FormField>
            <FormField label="Brand" htmlFor="as-brand" error={errors.brand}>
              <Input id="as-brand" placeholder="e.g. Apple" {...register("brand")} />
            </FormField>
            <FormField label="Model" htmlFor="as-model" error={errors.model}>
              <Input id="as-model" {...register("model")} />
            </FormField>
            <FormField label="Condition" htmlFor="as-cond" error={errors.condition}>
              <FormSelect control={control} name="condition" id="as-cond" options={CONDITION_OPTIONS} />
            </FormField>
            <FormField label="Location (branch)" htmlFor="as-branch" error={errors.branchId}>
              <FormSelect
                control={control}
                name="branchId"
                id="as-branch"
                emptyLabel="— None —"
                options={branches.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                }))}
              />
            </FormField>
            <FormField label="Purchase date" htmlFor="as-pdate" error={errors.purchaseDate}>
              <FormDatePicker control={control} name="purchaseDate" id="as-pdate" max={isoDate(new Date())} dropdowns clearable />
            </FormField>
            <FormField label="Cost (₹)" htmlFor="as-cost" error={errors.purchaseCost}>
              <Input id="as-cost" type="number" min={0} inputMode="decimal" {...register("purchaseCost")} />
            </FormField>
            <FormField label="Warranty until" htmlFor="as-warranty" error={errors.warrantyUntil}>
              <FormDatePicker control={control} name="warrantyUntil" id="as-warranty" dropdowns clearable />
            </FormField>
            <FormField label="Notes" htmlFor="as-notes" error={errors.notes} span="lg">
              <Textarea id="as-notes" rows={2} {...register("notes")} />
            </FormField>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="asset-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} {asset ? "Save" : "Add asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Row = { key: number; category: string; tag: string; assetId?: Id };
type Available = Awaited<ReturnType<typeof assetsService.available>>[number];
let rowKey = 0;
const newRow = (category = "", tag = "", assetId?: Id): Row => ({ key: ++rowKey, category, tag, assetId });

// Give items to an employee: each row is a category plus an optional serial / asset no. (the sticker on it)
function AssignForm({ employeeId: fixedEmployee, asset, onClose, onDone }: { employeeId?: Id; asset?: Asset | null; onClose: () => void; onDone: () => void }) {
  const employees = useEmployeesStore((s) => s.list);
  const loadEmployees = useEmployeesStore((s) => s.load);
  const [available, setAvailable] = useState<Available[]>([]);
  const [employeeId, setEmployeeId] = useState(fixedEmployee ? String(fixedEmployee) : "");
  const [rows, setRows] = useState<Row[]>(() => [asset ? newRow(asset.category, asset.serial_number || asset.asset_code, asset.id) : newRow()]);
  const [assignedOn, setAssignedOn] = useState(isoDate(new Date()));
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Free items, only used as suggestions for the serial box
  useEffect(() => {
    if (!fixedEmployee && !useEmployeesStore.getState().list.length) loadEmployees();
    let cancelled = false;
    run(() => assetsService.available()).then((r) => !cancelled && r.ok && setAvailable(r.data));
    return () => {
      cancelled = true;
    };
  }, [fixedEmployee, loadEmployees]);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ready = rows.filter((r) => r.category);
  const person = fixedEmployee ? employees.find((e) => e.id === fixedEmployee) : null;
  const suggestionLabel = (a: Available) => [a.asset_code, a.name, [a.brand, a.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

  async function save() {
    if (!employeeId || !ready.length) return;
    setBusy(true);
    const r = await run(
      () =>
        assetsService.assignMany({
          employeeId: Number(employeeId),
          items: ready.map((row) => ({ assetId: row.assetId ?? null, category: row.category, tag: row.tag.trim() || null })),
          assignedOn,
          expectedReturn: expectedReturn || null,
          notes: notes || null,
        }),
      { success: ready.length === 1 ? "Asset assigned" : `${ready.length} assets assigned` },
    );
    setBusy(false);
    if (!r.ok) return;
    onClose();
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign assets</DialogTitle>
        <DialogDescription>{person ? `Give items to ${person.name}` : "Pick the employee, then add each item they get — laptop, mouse, keyboard…"}</DialogDescription>
      </DialogHeader>
      {!fixedEmployee && (
        <FormGrid density="dialog">
          <FormField label="Employee" htmlFor="ag-emp" required span="full">
            <SelectField
              id="ag-emp"
              value={employeeId}
              onValueChange={setEmployeeId}
              placeholder="Pick an employee"
              options={employees.filter((e) => e.status !== "exited").map((e) => ({ value: String(e.id), label: `${e.name}${e.employee_code ? ` · ${e.employee_code}` : ""}` }))}
            />
          </FormField>
        </FormGrid>
      )}

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 text-xs font-medium text-muted-foreground">
          <span>Item</span>
          <span>Serial / asset no. (optional)</span>
          <span className="w-9" />
        </div>
        {rows.map((row, i) => {
          const suggestions = available.filter((a) => a.category === row.category && (a.serial_number || a.asset_code));
          return (
            <div key={row.key} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
              <SelectField aria-label={`Item ${i + 1}`} value={row.category} onValueChange={(v) => setRow(row.key, { category: v, assetId: undefined })} placeholder="Laptop, mouse…" options={CATEGORY_OPTIONS} />
              <Input
                aria-label={`Serial or asset no. ${i + 1}`}
                value={row.tag}
                onChange={(e) => setRow(row.key, { tag: e.target.value, assetId: undefined })}
                placeholder="Leave empty if it has none"
                list={suggestions.length ? `ag-tags-${row.key}` : undefined}
                maxLength={100}
              />
              {suggestions.length > 0 && (
                <datalist id={`ag-tags-${row.key}`}>
                  {suggestions.map((a) => (
                    <option key={a.id} value={a.serial_number || a.asset_code}>
                      {suggestionLabel(a)}
                    </option>
                  ))}
                </datalist>
              )}
              <Button variant="ghost" size="icon" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}>
                <X />
              </Button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="self-start" disabled={rows.length >= 20} onClick={() => setRows((rs) => [...rs, newRow()])}>
          <Plus /> Add another item
        </Button>
        <p className="text-xs text-muted-foreground">A number you already added picks that item; a new number adds it to your assets. Without a number, a free one of that kind is used.</p>
      </div>

      <FormGrid density="dialog">
        <FormField label="Given on" htmlFor="ag-on" required span="md">
          <DatePicker id="ag-on" value={assignedOn} onChange={setAssignedOn} />
        </FormField>
        <FormField label="Expected back" htmlFor="ag-back" span="md">
          <DatePicker id="ag-back" value={expectedReturn} onChange={setExpectedReturn} min={assignedOn} clearable />
        </FormField>
        <FormField label="Notes" htmlFor="ag-notes" span="full">
          <Input id="ag-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Charger, bag included…" />
        </FormField>
      </FormGrid>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || !employeeId || !ready.length}>
          {busy && <Spinner />} Assign{ready.length > 1 ? ` ${ready.length} items` : ""}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AssignDialog({ open, onClose, ...rest }: { open: boolean; employeeId?: Id; asset?: Asset | null; onClose: () => void; onDone: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">{open && <AssignForm onClose={onClose} {...rest} />}</DialogContent>
    </Dialog>
  );
}

// Take an asset back
export function ReturnDialog({ asset, onClose, onDone }: { asset: Asset | null; onClose: () => void; onDone: () => void }) {
  const [returnedOn, setReturnedOn] = useState(isoDate(new Date()));
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [status, setStatus] = useState<"available" | "in_repair" | "retired" | "lost">("available");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!asset) return;
    setBusy(true);
    const r = await run(
      () =>
        assetsService.giveBack(asset.id, {
          returnedOn,
          condition,
          status,
          notes: notes || null,
        }),
      { success: "Asset returned" },
    );
    setBusy(false);
    if (!r.ok) return;
    setNotes("");
    onClose();
    onDone();
  }

  return (
    <Dialog open={Boolean(asset)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take back {asset?.asset_code}</DialogTitle>
          <DialogDescription>
            From {asset?.holder_name} · with them since {fmtDate(asset?.held_since)}
          </DialogDescription>
        </DialogHeader>
        <FormGrid density="dialog">
          <FormField label="Returned on" htmlFor="rt-on" required span="md">
            <DatePicker id="rt-on" value={returnedOn} onChange={setReturnedOn} min={asset?.held_since ?? undefined} max={isoDate(new Date())} />
          </FormField>
          <FormField label="Condition" htmlFor="rt-cond" span="md">
            <SelectField id="rt-cond" value={condition} onValueChange={(v) => setCondition(v as AssetCondition)} options={CONDITION_OPTIONS} />
          </FormField>
          <FormField label="Then" htmlFor="rt-status" span="full">
            <SelectField
              id="rt-status"
              value={status}
              onValueChange={(v) => setStatus(v as typeof status)}
              options={[
                {
                  value: "available",
                  label: "Back in stock — can be given again",
                },
                { value: "in_repair", label: "Send for repair" },
                { value: "retired", label: "Retire it" },
                { value: "lost", label: "Lost / not returned" },
              ]}
            />
          </FormField>
          <FormField label="Notes" htmlFor="rt-notes" span="full">
            <Input id="rt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scratches on lid, charger missing…" />
          </FormField>
        </FormGrid>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Spinner />} Take back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Who had it, when
export function HistoryDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const [rows, setRows] = useState<AssetHistoryRow[] | null>(null);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    run(() => assetsService.history(asset.id)).then((r) => !cancelled && setRows(r.ok ? r.data : []));
    return () => {
      cancelled = true;
    };
  }, [asset]);

  return (
    <Dialog
      open={Boolean(asset)}
      onOpenChange={(o) => {
        if (!o) {
          setRows(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{asset?.asset_code} · history</DialogTitle>
          <DialogDescription>{asset?.name}</DialogDescription>
        </DialogHeader>
        {!rows ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Never assigned yet.</p>
        ) : (
          <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {rows.map((h) => (
              <li key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{h.employee_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(h.assigned_on)} → {h.returned_on ? fmtDate(h.returned_on) : "with them now"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    h.assigned_by && `Given by ${h.assigned_by}`,
                    h.assign_notes,
                    h.return_condition && `Returned ${ASSET_CONDITION_LABELS[h.return_condition].toLowerCase()}`,
                    h.return_notes,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
