"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, ExternalLink, MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FORM_DIALOG, FormGrid, FormHeading } from "@/components/common/form-layout";
import { FormSelect } from "@/components/common/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { branchSchema, type BranchForm, type BranchPayload } from "@/lib/schemas/branch";
import { branchesService } from "@/lib/services/branches";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: BranchForm = {
  name: "",
  code: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
  phone: "",
  email: "",
  latitude: "",
  longitude: "",
  radiusM: "200",
  geofence: "off",
  headOffice: "no",
  status: "active",
};

const toForm = (b: Branch): BranchForm => ({
  name: b.name,
  code: b.code ?? "",
  address: b.address ?? "",
  city: b.city ?? "",
  state: b.state ?? "",
  country: b.country ?? "",
  postalCode: b.postal_code ?? "",
  phone: b.phone ?? "",
  email: b.email ?? "",
  latitude: b.latitude == null ? "" : String(b.latitude),
  longitude: b.longitude == null ? "" : String(b.longitude),
  radiusM: String(b.radius_m),
  geofence: b.geofence_enabled ? "on" : "off",
  headOffice: b.is_head_office ? "yes" : "no",
  status: b.is_active ? "active" : "inactive",
});

const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

// A company's offices; employees are tagged to one and office check-ins must be inside its radius
export function BranchesPanel() {
  const [list, setList] = useState<Branch[] | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await run(branchesService.list);
    if (r.ok) setList(r.data);
  }

  useEffect(() => {
    let cancelled = false;
    run(branchesService.list).then((r) => !cancelled && r.ok && setList(r.data));
    return () => {
      cancelled = true;
    };
  }, []);

  function openForm(b: Branch | null) {
    setEditing(b);
    setOpen(true);
  }

  async function remove(b: Branch) {
    if ((await run(() => branchesService.remove(b.id), { success: "Branch removed" })).ok) load();
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <FormHeading
        title={`Branches${list ? ` · ${list.length}` : ""}`}
        actions={
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus /> Add branch
          </Button>
        }
      />
      {!list ? (
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={MapPin} title="No branches yet" description="Add your offices. Employees are tagged to a branch, and office check-ins can be limited to its radius." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Check-in radius</TableHead>
              <TableHead className="w-28 text-right">Employees</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <span className={cn("font-medium", !b.is_active && "text-muted-foreground")}>{b.name}</span>
                  {b.code && <span className="ml-2 font-mono text-xs text-muted-foreground">{b.code}</span>}
                  {b.is_head_office && (
                    <Badge variant="outline" className="ml-2">
                      Head office
                    </Badge>
                  )}
                  {b.address && <span className="block max-w-md truncate text-xs text-muted-foreground">{b.address}</span>}
                </TableCell>
                <TableCell>{[b.city, b.state].filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell>
                  {b.latitude != null && b.longitude != null ? (
                    <span className="flex items-center gap-2">
                      {b.geofence_enabled ? <Badge>{b.radius_m} m</Badge> : <span className="text-xs text-muted-foreground">Off</span>}
                      <a href={mapsLink(b.latitude, b.longitude)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`${b.name} on Google Maps`}>
                        <ExternalLink className="size-3.5" />
                      </a>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No location</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{b.employee_count}</TableCell>
                <TableCell>
                  <Badge variant={b.is_active ? "default" : "secondary"} className="w-16 justify-center">
                    {b.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openForm(b)} aria-label={`Edit ${b.name}`}>
                      <Pencil />
                    </Button>
                    <ConfirmDelete
                      title={`Remove “${b.name}”?`}
                      description={b.employee_count ? `${b.employee_count} employee${b.employee_count === 1 ? " is" : "s are"} tagged here — they'll have no branch until you pick one.` : undefined}
                      onConfirm={() => remove(b)}
                      label="Remove"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <BranchDialog open={open} onOpenChange={setOpen} branch={editing} onSaved={load} />
    </section>
  );
}

function BranchDialog({ open, onOpenChange, branch, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; branch: Branch | null; onSaved: () => void }) {
  const [locating, setLocating] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BranchForm, unknown, BranchPayload>({ resolver: zodResolver(branchSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) reset(branch ? toForm(branch) : EMPTY);
  }, [open, branch, reset]);

  // Fill the coordinates from this device (stand inside the office)
  function fillMyLocation() {
    if (!("geolocation" in navigator)) return toast.error("This browser can't share its location");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValue("latitude", p.coords.latitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setValue("longitude", p.coords.longitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setLocating(false);
        toast.success(`Location set (accurate to about ${Math.round(p.coords.accuracy)} m)`);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get the location — allow location access or type the coordinates");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onSubmit(payload: BranchPayload) {
    const r = await run(() => (branch ? branchesService.update(branch.id, payload) : branchesService.create(payload)), { success: branch ? "Branch updated" : "Branch added" });
    if (!r.ok) return;
    onOpenChange(false);
    onSaved();
  }

  const [latText, lngText] = useWatch({ control, name: ["latitude", "longitude"] });
  const lat = Number(latText);
  const lng = Number(lngText);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={FORM_DIALOG}>
        <DialogHeader>
          <DialogTitle>{branch ? `Edit ${branch.name}` : "Add branch"}</DialogTitle>
        </DialogHeader>
        <form id="branch-form" onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          <FormGrid density="dialog">
            <FormField label="Branch name" htmlFor="br-name" error={errors.name} required>
              <Input id="br-name" autoFocus placeholder="e.g. Head Office – Gurgaon" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </FormField>
            <FormField label="Code" htmlFor="br-code" error={errors.code}>
              <Input id="br-code" maxLength={20} placeholder="e.g. GGN" className="uppercase" {...register("code")} />
            </FormField>
            <FormField label="Phone" htmlFor="br-phone" error={errors.phone}>
              <Input id="br-phone" type="tel" {...register("phone")} />
            </FormField>
            <FormField label="Email" htmlFor="br-email" error={errors.email}>
              <Input id="br-email" type="email" {...register("email")} />
            </FormField>
            <FormField label="Address" htmlFor="br-address" error={errors.address} span="lg">
              <Textarea id="br-address" rows={2} placeholder="Building, street, area" {...register("address")} />
            </FormField>
            <FormField label="City" htmlFor="br-city" error={errors.city}>
              <Input id="br-city" {...register("city")} />
            </FormField>
            <FormField label="State" htmlFor="br-state" error={errors.state}>
              <Input id="br-state" {...register("state")} />
            </FormField>
            <FormField label="Pincode" htmlFor="br-pin" error={errors.postalCode}>
              <Input id="br-pin" inputMode="numeric" {...register("postalCode")} />
            </FormField>
            <FormField label="Country" htmlFor="br-country" error={errors.country}>
              <Input id="br-country" {...register("country")} />
            </FormField>

            <FieldSeparator label="Check-in location" />
            <FormField label="Latitude" htmlFor="br-lat" error={errors.latitude}>
              <Input id="br-lat" inputMode="decimal" placeholder="28.495300" {...register("latitude")} />
            </FormField>
            <FormField label="Longitude" htmlFor="br-lng" error={errors.longitude}>
              <Input id="br-lng" inputMode="decimal" placeholder="77.089500" {...register("longitude")} />
            </FormField>
            <FormField label="Radius (metres)" htmlFor="br-radius" error={errors.radiusM} description="Office check-ins must be within this distance">
              <Input id="br-radius" inputMode="numeric" {...register("radiusM")} />
            </FormField>
            <FormField label="Limit office check-in" htmlFor="br-geo" error={errors.geofence}>
              <FormSelect
                control={control}
                name="geofence"
                id="br-geo"
                options={[
                  { value: "on", label: "On — only inside the radius" },
                  { value: "off", label: "Off" },
                ]}
              />
            </FormField>
            <div className="col-span-12 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={fillMyLocation} disabled={locating}>
                {locating ? <Spinner /> : <Crosshair />} Use my current location
              </Button>
              {Number.isFinite(lat) && Number.isFinite(lng) && latText !== "" && lngText !== "" && (
                <a href={mapsLink(lat, lng)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Check on Google Maps <ExternalLink className="size-3.5" />
                </a>
              )}
              <span className="text-xs text-muted-foreground">Tip: stand inside the office, or copy the coordinates from Google Maps (right-click the building).</span>
            </div>

            <FieldSeparator label="Settings" />
            <FormField label="Head office" htmlFor="br-ho" error={errors.headOffice}>
              <FormSelect
                control={control}
                name="headOffice"
                id="br-ho"
                options={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes" },
                ]}
              />
            </FormField>
            <FormField label="Status" htmlFor="br-status" error={errors.status}>
              <FormSelect
                control={control}
                name="status"
                id="br-status"
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </FormField>
          </FormGrid>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="branch-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner />} {branch ? "Save" : "Add branch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
