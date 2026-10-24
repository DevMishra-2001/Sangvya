import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { fetchLeavePolicy, saveLeavePolicy } from "../store/slices/leavePolicySlice";
import { Input, Button } from "../components/formComponent";

const FIELDS = [
  { key: "clPerYear", api: "cl_per_year", label: "CL per year", hint: "Casual leave — unused days lapse at the end of the financial year (31 March)." },
  { key: "slPerYear", api: "sl_per_year", label: "SL per year", hint: "Sick leave — unused days carry forward to the next year." },
  { key: "olPerYear", api: "ol_per_year", label: "OL per year (default)", hint: "Optional leave — default for everyone; set a different number per employee on the Employees page." },
  { key: "elPerMonth", api: "el_per_month", label: "EL per month", hint: "Earned leave — unused days at month end are paid out." },
];

// HR / superadmin: company leave quotas used for every employee's balance.
export default function LeavePolicyPage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchLeavePolicy()).then((r) => {
      if (!r.error) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(r.payload[f.api])])));
    });
  }, [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await dispatch(saveLeavePolicy(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))));
    setSaving(false);
  }

  return (
    <div>
      <h1>Leave Policy</h1>
      <p className="text-sm text-slate mb-5">Leave quotas for the whole company. The leave year runs 1 April – 31 March.</p>
      {!form ? (
        <div className="text-sm text-slate">Loading…</div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-xl p-5 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Input
                  id={f.key}
                  name={f.key}
                  type="number"
                  lable={f.label}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  min={0}
                  max={f.key === "elPerMonth" ? 31 : 365}
                  required
                  removeFormGroupClass
                />
                <p className="text-2xs text-slate mt-1">{f.hint}</p>
              </div>
            ))}
          </div>
          <Button type="submit" name={saving ? "Saving…" : "Save policy"} className="btn-primary h-8 !py-0 mt-5" disabled={saving} />
        </form>
      )}
    </div>
  );
}
