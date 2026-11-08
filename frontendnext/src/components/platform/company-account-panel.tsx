"use client";

// Company sheet extras for the Super Admin: usage, plan & custom deal, support actions, private notes
import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { DatePicker } from "@/components/common/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { run } from "@/lib/api/run";
import { fmtDate, inr, isoDate, timeAgo } from "@/lib/format";
import { platformCompaniesService, type CompanyDetailResponse } from "@/lib/services/platform-companies";
import { usePlatformCompaniesStore } from "@/stores/platform-companies-store";

const title = (t: string) => <h3 className="mb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">{t}</h3>;
const addDays = (iso: string, n: number) => isoDate(new Date(new Date(`${iso}T00:00:00`).getTime() + n * 86400000));

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function CompanyAccountPanel({ data, onChange }: { data: CompanyDetailResponse; onChange: (d: CompanyDetailResponse) => void }) {
  const c = data.company;
  const reloadList = usePlatformCompaniesStore((s) => s.load);
  const trialEnd = c.trial_ends_at ? isoDate(new Date(c.trial_ends_at)) : isoDate(new Date());
  const [newEnd, setNewEnd] = useState(trialEnd);
  const [price, setPrice] = useState(String(Number(c.price_per_employee ?? 0)));
  const [notes, setNotes] = useState(c.admin_notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function save(key: string, fn: () => Promise<CompanyDetailResponse>, success: string) {
    setBusy(key);
    const r = await run(fn, { success });
    setBusy(null);
    if (!r.ok) return;
    onChange(r.data);
    void reloadList();
  }

  async function reset(userId: number) {
    setBusy(`reset-${userId}`);
    await run(() => platformCompaniesService.sendPasswordReset(c.id, userId), { success: (r) => `Reset code sent to ${r.sentTo}` });
    setBusy(null);
  }

  const monthly = Number(c.price_per_employee ?? 0) * (c.seats ?? 0);

  return (
    <>
      <section>
        {title("Usage")}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Active users (7 days)" value={`${c.active_users_7d} / ${c.user_count}`} />
          <Metric label="Last active" value={<span className="text-sm">{c.last_active_at ? timeAgo(c.last_active_at) : "Never"}</span>} />
          <Metric label="Checked in today" value={c.checkins_today} />
          <Metric label="Logins (30 days)" value={data.usage.logins} />
          <Metric label="Check-ins (30 days)" value={data.usage.checkins} />
          <Metric label="Leave requests (30 days)" value={data.usage.leaves} />
        </div>
      </section>

      <section>
        {title("Plan & price")}
        <div className="space-y-3 rounded-lg border p-3 text-sm">
          <p>
            <span className="font-medium capitalize">{c.subscription_status?.replace("_", " ") ?? "No plan"}</span>
            {c.subscription_status === "trial" && c.trial_ends_at && ` · trial ends ${fmtDate(c.trial_ends_at)}`}
            {c.subscription_status === "active" && ` · ${c.seats} employees × ${inr(Number(c.price_per_employee))} = ${inr(monthly)}/month`}
            {c.current_period_end && c.subscription_status === "active" && ` · renews ${fmtDate(c.current_period_end)}`}
          </p>

          {c.subscription_status === "trial" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Trial ends</span>
              <DatePicker value={newEnd} onChange={setNewEnd} className="w-40" aria-label="New trial end" />
              {[7, 14, 30].map((n) => (
                <Button key={n} size="sm" variant="outline" onClick={() => setNewEnd(addDays(trialEnd < isoDate(new Date()) ? isoDate(new Date()) : trialEnd, n))}>
                  +{n} days
                </Button>
              ))}
              <Button size="sm" disabled={busy !== null || newEnd === trialEnd} onClick={() => save("trial", () => platformCompaniesService.setSubscription(c.id, { trialEndsOn: newEnd }), "Trial updated")}>
                {busy === "trial" && <Spinner />} Save
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Price per employee (₹)</span>
            <Input type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-24" aria-label="Price per employee" />
            <Button
              size="sm"
              disabled={busy !== null || price === "" || Number(price) === Number(c.price_per_employee ?? 0)}
              onClick={() => save("price", () => platformCompaniesService.setSubscription(c.id, { pricePerEmployee: Number(price) }), "Price updated")}
            >
              {busy === "price" && <Spinner />} Save
            </Button>
          </div>
          {c.subscription_status === "active" && <p className="text-xs text-muted-foreground">A paying company is charged by its Razorpay plan — change the plan in Razorpay too.</p>}
        </div>
      </section>

      <section>
        {title("Support")}
        <div className="divide-y rounded-lg border px-3">
          {data.admins.length ? (
            data.admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                </span>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => reset(a.id)}>
                  {busy === `reset-${a.id}` ? <Spinner /> : <KeyRound />} Send password reset
                </Button>
              </div>
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No admin logins.</p>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">They get a 6-digit code by email to set a new password on the “Forgot password” page.</p>
      </section>

      <section>
        {title("Private notes (only Super Admins see these)")}
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Deal terms, calls, special requests…" aria-label="Private notes" />
        <Button
          size="sm"
          className="mt-2"
          variant="outline"
          disabled={busy !== null || notes === (c.admin_notes ?? "")}
          onClick={() => save("notes", () => platformCompaniesService.setNotes(c.id, notes.trim() || null), "Notes saved")}
        >
          {busy === "notes" ? <Spinner /> : <Save />} Save notes
        </Button>
      </section>
    </>
  );
}
