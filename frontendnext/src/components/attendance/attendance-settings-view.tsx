"use client";

// Attendance Settings: the company's own attendance rules — hours, half day, late penalty,
// weekly offs, check-in requirements, corrections and overtime
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarOff, Camera, Clock, Hourglass, Save, Timer, Wrench } from "lucide-react";
import { AuditInfo } from "@/components/common/audit-info";
import { FormField } from "@/components/common/form-field";
import { FieldSeparator, FormCard, FormGrid } from "@/components/common/form-layout";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParams } from "@/hooks/use-url-params";
import { run } from "@/lib/api/run";
import { attendanceSettingsService, type AttendanceSettingsData, type WeekDay } from "@/lib/services/attendance-settings";
import { cn } from "@/lib/utils";

const DAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];
const WEEKS = [1, 2, 3, 4, 5];
const NTH = ["1st", "2nd", "3rd", "4th", "5th"];

// Hours in the form ("8.5"), minutes in the API
const toHours = (m: number) => String(Math.round((m / 60) * 100) / 100);
const toMinutes = (h: string) => Math.round(Number(h || 0) * 60);
const opt = (v: number | null) => (v == null ? "" : String(v));

type Form = {
  workDays: WeekDay[];
  offSaturdays: number[];
  requiredHours: string;
  breakMinutes: string;
  statusByHours: boolean;
  halfDayHours: string;
  absentHours: string;
  latePenaltyEnabled: boolean;
  lateMarks: string;
  latePenalty: "half" | "full";
  countEarlyLeaving: boolean;
  earlyGrace: string;
  photoRule: "required" | "optional" | "off";
  locationRule: "required" | "optional";
  geofenceEnabled: boolean;
  earlyCheckIn: string;
  missingCheckout: "flag" | "shift_end" | "half";
  correctionsEnabled: boolean;
  correctionDays: string;
  correctionsPerMonth: string;
  overtimeEnabled: boolean;
  overtimeAfter: string;
};

function toForm({ settings: s, workDays }: AttendanceSettingsData): Form {
  return {
    workDays,
    offSaturdays: (s.off_saturdays ?? "").split(",").filter(Boolean).map(Number),
    requiredHours: toHours(s.default_required_minutes),
    breakMinutes: String(s.default_break_minutes),
    statusByHours: s.status_by_hours,
    halfDayHours: toHours(s.half_day_below_minutes),
    absentHours: toHours(s.absent_below_minutes),
    latePenaltyEnabled: s.late_penalty_enabled,
    lateMarks: String(s.late_marks_per_penalty),
    latePenalty: s.late_penalty,
    countEarlyLeaving: s.count_early_leaving,
    earlyGrace: String(s.early_leaving_grace_minutes),
    photoRule: s.photo_rule,
    locationRule: s.location_rule,
    geofenceEnabled: s.geofence_enabled,
    earlyCheckIn: opt(s.early_check_in_minutes),
    missingCheckout: s.missing_checkout,
    correctionsEnabled: s.corrections_enabled,
    correctionDays: String(s.correction_days_back),
    correctionsPerMonth: opt(s.corrections_per_month),
    overtimeEnabled: s.overtime_enabled,
    overtimeAfter: String(s.overtime_after_minutes),
  };
}

// A switch with its label and a short hint
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="col-span-12 flex items-start gap-2.5 rounded-lg border p-2.5 text-sm md:col-span-6">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

// Explains a rule in plain words under the fields
function Note({ children }: { children: React.ReactNode }) {
  return <p className="col-span-12 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{children}</p>;
}

export function AttendanceSettingsView() {
  const url = useUrlParams();
  const tab = url.get("tab", "hours");
  const [data, setData] = useState<AttendanceSettingsData | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    run(attendanceSettingsService.get).then((r) => {
      if (cancelled || !r.ok) return;
      setData(r.data);
      setF(toForm(r.data));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || !f) return <Skeleton className="h-96 rounded-xl" />;
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const toggleDay = (d: WeekDay) => set("workDays")(f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d]);
  const toggleSat = (w: number) => set("offSaturdays")(f.offSaturdays.includes(w) ? f.offSaturdays.filter((x) => x !== w) : [...f.offSaturdays, w]);
  const halfBad = f.statusByHours && toMinutes(f.absentHours) >= toMinutes(f.halfDayHours);

  async function save() {
    if (!f) return;
    setBusy(true);
    const r = await run(
      () =>
        attendanceSettingsService.save({
          workDays: DAYS.map((d) => d.key).filter((d) => f.workDays.includes(d)),
          offSaturdays: f.offSaturdays,
          defaultRequiredMinutes: toMinutes(f.requiredHours),
          defaultBreakMinutes: Number(f.breakMinutes || 0),
          statusByHours: f.statusByHours,
          halfDayBelowMinutes: toMinutes(f.halfDayHours),
          absentBelowMinutes: toMinutes(f.absentHours),
          latePenaltyEnabled: f.latePenaltyEnabled,
          lateMarksPerPenalty: Number(f.lateMarks || 1),
          latePenalty: f.latePenalty,
          countEarlyLeaving: f.countEarlyLeaving,
          earlyLeavingGraceMinutes: Number(f.earlyGrace || 0),
          photoRule: f.photoRule,
          locationRule: f.locationRule,
          geofenceEnabled: f.geofenceEnabled,
          earlyCheckInMinutes: f.earlyCheckIn === "" ? null : Number(f.earlyCheckIn),
          missingCheckout: f.missingCheckout,
          correctionsEnabled: f.correctionsEnabled,
          correctionDaysBack: Number(f.correctionDays || 30),
          correctionsPerMonth: f.correctionsPerMonth === "" ? null : Number(f.correctionsPerMonth),
          overtimeEnabled: f.overtimeEnabled,
          overtimeAfterMinutes: Number(f.overtimeAfter || 0),
        }),
      { success: "Attendance settings saved" },
    );
    setBusy(false);
    if (r.ok) {
      setData(r.data);
      setF(toForm(r.data));
    }
  }

  const footer = (
    <div className="col-span-12 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <AuditInfo row={data.settings} />
      <Button onClick={save} disabled={busy || f.workDays.length === 0 || halfBad}>
        {busy ? <Spinner /> : <Save />} Save settings
      </Button>
    </div>
  );

  return (
    <FormCard title="Attendance Settings" icon={Wrench} bodyClassName="p-0">
      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v === "hours" ? null : v })} className="gap-0">
        <div className="overflow-x-auto border-b px-3 pt-2">
          <TabsList variant="line" className="h-auto">
            <TabsTrigger value="hours">
              <Clock /> Work hours
            </TabsTrigger>
            <TabsTrigger value="late">
              <Hourglass /> Late &amp; early
            </TabsTrigger>
            <TabsTrigger value="weekoff">
              <CalendarOff /> Weekly off
            </TabsTrigger>
            <TabsTrigger value="checkin">
              <Camera /> Check-in
            </TabsTrigger>
            <TabsTrigger value="corrections">Corrections</TabsTrigger>
            <TabsTrigger value="overtime">
              <Timer /> Overtime
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-3">
          <TabsContent value="hours">
            <FormGrid>
              <FieldSeparator label="Default day (for people without a shift)" />
              <FormField label="Required hours a day" htmlFor="as-req" description="Check-in to check-out, breaks included">
                <Input id="as-req" type="number" min={1} max={24} step={0.25} value={f.requiredHours} onChange={(e) => set("requiredHours")(e.target.value)} />
              </FormField>
              <FormField label="Break allowed (minutes)" htmlFor="as-break">
                <Input id="as-break" type="number" min={0} max={600} value={f.breakMinutes} onChange={(e) => set("breakMinutes")(e.target.value)} />
              </FormField>
              <Note>
                Shifts have their own timings, grace and break — set them in{" "}
                <Link href="/shifts" className="font-medium text-primary hover:underline">
                  Shifts
                </Link>
                . These hours apply to anyone without a shift.
              </Note>
              <FieldSeparator label="Present, half day or absent by hours" />
              <Toggle checked={f.statusByHours} onChange={set("statusByHours")} label="Mark the day by hours worked" hint="Decided when the day closes; payroll and reports follow it" />
              {f.statusByHours && (
                <>
                  <FormField label="Half day if less than (hours)" htmlFor="as-half">
                    <Input id="as-half" type="number" min={0} max={24} step={0.25} value={f.halfDayHours} onChange={(e) => set("halfDayHours")(e.target.value)} />
                  </FormField>
                  <FormField label="Absent if less than (hours)" htmlFor="as-absent" error={halfBad ? { message: "Must be less than the half-day hours" } : undefined}>
                    <Input id="as-absent" type="number" min={0} max={24} step={0.25} value={f.absentHours} onChange={(e) => set("absentHours")(e.target.value)} />
                  </FormField>
                  <Note>
                    Example: worked {f.absentHours || 0}h or more but less than {f.halfDayHours || 0}h = <b>Half day</b>; less than {f.absentHours || 0}h = <b>Absent</b>; otherwise Present.
                  </Note>
                </>
              )}
              {footer}
            </FormGrid>
          </TabsContent>

          <TabsContent value="late">
            <FormGrid>
              <FieldSeparator label="Late mark penalty" />
              <Toggle checked={f.latePenaltyEnabled} onChange={set("latePenaltyEnabled")} label="Cut pay for repeated late marks" hint="Applied in payroll as loss of pay (LOP)" />
              {f.latePenaltyEnabled && (
                <>
                  <FormField label="Every N late marks in a month" htmlFor="as-marks">
                    <Input id="as-marks" type="number" min={1} max={31} value={f.lateMarks} onChange={(e) => set("lateMarks")(e.target.value)} />
                  </FormField>
                  <FormField label="Cut" htmlFor="as-cut">
                    <SelectField
                      id="as-cut"
                      value={f.latePenalty}
                      onValueChange={(v) => set("latePenalty")(v as "half" | "full")}
                      options={[
                        { value: "half", label: "Half day" },
                        { value: "full", label: "Full day" },
                      ]}
                    />
                  </FormField>
                  <Note>
                    Example: every {f.lateMarks || 1} late marks = {f.latePenalty === "full" ? "1 day" : "half a day"} LOP. A late mark comes after the shift&apos;s grace time.
                  </Note>
                </>
              )}
              <FieldSeparator label="Early leaving" />
              <Toggle checked={f.countEarlyLeaving} onChange={set("countEarlyLeaving")} label="Count early check-outs as late marks" hint="Leaving before the shift ends adds to the same count" />
              {f.countEarlyLeaving && (
                <FormField label="Allowed early (minutes)" htmlFor="as-early">
                  <Input id="as-early" type="number" min={0} max={240} value={f.earlyGrace} onChange={(e) => set("earlyGrace")(e.target.value)} />
                </FormField>
              )}
              {footer}
            </FormGrid>
          </TabsContent>

          <TabsContent value="weekoff">
            <FormGrid>
              <FieldSeparator label="Working days" />
              <div className="col-span-12 flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = f.workDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      aria-pressed={on}
                      className={cn("h-9 w-14 rounded-lg border text-sm font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <Note>Unselected days are weekly offs: no attendance needed, not counted in leave, paid in payroll.</Note>
              {f.workDays.includes("sat") && (
                <>
                  <FieldSeparator label="Saturdays off (by week of the month)" />
                  <div className="col-span-12 flex flex-wrap gap-2">
                    {WEEKS.map((w) => {
                      const on = f.offSaturdays.includes(w);
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => toggleSat(w)}
                          aria-pressed={on}
                          className={cn("h-9 rounded-lg border px-3 text-sm font-medium transition-colors", on ? "border-warning bg-warning/15 text-warning" : "bg-background text-muted-foreground hover:bg-muted")}
                        >
                          {NTH[w - 1]} Sat
                        </button>
                      );
                    })}
                  </div>
                  <Note>{f.offSaturdays.length ? `${[...f.offSaturdays].sort().map((w) => NTH[w - 1]).join(" & ")} Saturday of every month will be off.` : "Every Saturday is a working day."}</Note>
                </>
              )}
              <Note>
                Holidays are set in{" "}
                <Link href="/holidays" className="font-medium text-primary hover:underline">
                  Holidays
                </Link>
                .
              </Note>
              {footer}
            </FormGrid>
          </TabsContent>

          <TabsContent value="checkin">
            <FormGrid>
              <FieldSeparator label="What check-in needs" />
              <FormField label="Selfie photo" htmlFor="as-photo" span="md">
                <SelectField
                  id="as-photo"
                  value={f.photoRule}
                  onValueChange={(v) => set("photoRule")(v as Form["photoRule"])}
                  options={[
                    { value: "required", label: "Required — no photo, no check-in" },
                    { value: "optional", label: "Ask — allow when the camera doesn't work" },
                    { value: "off", label: "Off — don't open the camera" },
                  ]}
                />
              </FormField>
              <FormField label="Location" htmlFor="as-loc" span="md">
                <SelectField
                  id="as-loc"
                  value={f.locationRule}
                  onValueChange={(v) => set("locationRule")(v as Form["locationRule"])}
                  options={[
                    { value: "required", label: "Required — must share location" },
                    { value: "optional", label: "Ask — allow without it" },
                  ]}
                />
              </FormField>
              <Toggle checked={f.geofenceEnabled} onChange={set("geofenceEnabled")} label="Office radius check" hint="Office check-in must be within the branch's radius (set per branch)" />
              <FormField label="Earliest check-in (minutes before shift)" htmlFor="as-earlyin" description="Empty = any time">
                <Input id="as-earlyin" type="number" min={0} max={720} value={f.earlyCheckIn} onChange={(e) => set("earlyCheckIn")(e.target.value)} />
              </FormField>
              <FieldSeparator label="Forgot to check out" />
              <FormField label="When someone doesn't check out" htmlFor="as-missing" span="lg">
                <SelectField
                  id="as-missing"
                  value={f.missingCheckout}
                  onValueChange={(v) => set("missingCheckout")(v as Form["missingCheckout"])}
                  options={[
                    { value: "flag", label: "Flag it — tell the employee and manager" },
                    { value: "shift_end", label: "Check them out at the shift's end time" },
                    { value: "half", label: "Mark it a half day" },
                  ]}
                />
              </FormField>
              <Note>The employee and their manager are always told about a missing check-out; they can fix it with a correction.</Note>
              {footer}
            </FormGrid>
          </TabsContent>

          <TabsContent value="corrections">
            <FormGrid>
              <FieldSeparator label="Attendance corrections (regularisation)" />
              <Toggle checked={f.correctionsEnabled} onChange={set("correctionsEnabled")} label="Allow corrections" hint="Employees ask to fix a past day; the manager or HR approves" />
              {f.correctionsEnabled && (
                <>
                  <FormField label="How far back (days)" htmlFor="as-cdays">
                    <Input id="as-cdays" type="number" min={1} max={365} value={f.correctionDays} onChange={(e) => set("correctionDays")(e.target.value)} />
                  </FormField>
                  <FormField label="Most per month" htmlFor="as-cmonth" description="Empty = no limit">
                    <Input id="as-cmonth" type="number" min={0} max={31} value={f.correctionsPerMonth} onChange={(e) => set("correctionsPerMonth")(e.target.value)} />
                  </FormField>
                </>
              )}
              {footer}
            </FormGrid>
          </TabsContent>

          <TabsContent value="overtime">
            <FormGrid>
              <FieldSeparator label="Overtime" />
              <Toggle checked={f.overtimeEnabled} onChange={set("overtimeEnabled")} label="Count overtime" hint="Shown on the attendance report for each day" />
              {f.overtimeEnabled && (
                <>
                  <FormField label="Count after (minutes past required)" htmlFor="as-ot">
                    <Input id="as-ot" type="number" min={0} max={600} value={f.overtimeAfter} onChange={(e) => set("overtimeAfter")(e.target.value)} />
                  </FormField>
                  <Note>
                    Example: a 9h day with {f.overtimeAfter || 0} min = overtime starts after {toHours(toMinutes("9") + Number(f.overtimeAfter || 0))}h; a 10h day then shows 1h overtime.
                  </Note>
                </>
              )}
              {footer}
            </FormGrid>
          </TabsContent>
        </div>
      </Tabs>
    </FormCard>
  );
}
