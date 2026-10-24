import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { requestLeave } from "../../store/slices/leaveSlice";
import { LEAVE_TYPE_LABELS, APPLY_LEAVE_TYPES, fmtTime, fmtMinutes } from "../../utils/workday";
import { ReactSelect } from "../formComponent";

// Details for one calendar day + the apply form.
// Working days → CL / SL / OL / EL / Comp Off (with the balance left shown for each).
// Off days (Sunday/holiday) need no leave; working one earns a Comp Off automatically.
export default function DayModal({ date, info, rules, balances, onClose, onApplied }) {
  const dispatch = useDispatch();
  const { day, holiday, isSunday, leaves } = info;
  const offDay = isSunday || Boolean(holiday);
  const worked = Boolean(day?.punchIn) || day?.status === "present";
  const activeLeave = leaves.find((l) => l.status !== "rejected");

  let options = [];
  let blockedReason = null;
  if (activeLeave) blockedReason = `A ${LEAVE_TYPE_LABELS[activeLeave.leave_type] || "leave"} request for this day is already ${activeLeave.status}.`;
  else if (offDay && worked) blockedReason = "You worked on this day off — 1 Comp Off has been added to your balance. Use it on any working day.";
  else if (offDay) blockedReason = isSunday ? "Sunday is a weekly off." : `This day is a holiday (${holiday.name}).`;
  else options = APPLY_LEAVE_TYPES;

  const [form, setForm] = useState({ leaveType: options[0] || "", reason: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const result = await dispatch(requestLeave({ fromDate: date, toDate: date, leaveType: form.leaveType, reason: form.reason }));
    setSaving(false);
    if (!result.error) onApplied();
  }

  const title = new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        {holiday && <div className="text-sm text-brass mb-2">Holiday: {holiday.name}</div>}

        {day?.punchIn && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm bg-ivory rounded-md p-3 mb-2">
            <span className="text-slate">Punch in</span><span>{fmtTime(day.punchIn)}</span>
            <span className="text-slate">Punch out</span><span>{fmtTime(day.punchOut)}</span>
            <span className="text-slate">Break</span>
            <span className={day.breakMinutes > rules.maxBreakMinutes ? "text-rust" : ""}>{fmtMinutes(day.breakMinutes)}</span>
            <span className="text-slate">Total</span>
            <span className={day.shortDay ? "text-rust" : ""}>{fmtMinutes(day.totalMinutes)}</span>
          </div>
        )}

        {leaves.map((l) => (
          <div key={l.id} className="text-sm mb-1">
            {LEAVE_TYPE_LABELS[l.leave_type] || "Leave"} — <span className={`status-pill status-${l.status}`}>{l.status}</span>
            {l.reason && <div className="text-xs text-slate mt-0.5">{l.reason}</div>}
          </div>
        ))}

        {blockedReason ? (
          <div className="text-sm text-slate mt-2">{blockedReason}</div>
        ) : (
          <>
            <ReactSelect
              id="leaveType"
              name="leaveType"
              placeholderName="Type"
              dynamicOptions={options.map((o) => ({
                value: o,
                label: balances?.[o] ? `${LEAVE_TYPE_LABELS[o]} — ${balances[o].available} left` : LEAVE_TYPE_LABELS[o],
              }))}
              value={form.leaveType}
              handleChange={(_, option) => setForm({ ...form, leaveType: option?.value || "" })}
              removeIsClearable
              respclass="mt-3"
            />
            <label>Description</label>
            <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            <button type="submit" className="btn-primary justify-center mt-5" disabled={saving}>
              {saving ? "Applying..." : "Apply"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
