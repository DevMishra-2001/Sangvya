import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchToday, punchAction } from "../../store/slices/selfSlice";
import { fmtTime, fmtMinutes, liveTotals } from "../../utils/workday";

function Stat({ label, value, warn }) {
  return (
    <div>
      <div className="text-xs text-slate mb-1">{label}</div>
      <div className={`font-serif text-xl ${warn ? "text-rust" : ""}`}>{value}</div>
    </div>
  );
}

// Today's punches with a live running total. Punch out = break starts; punching
// in again the same day ends the break. The day ends at the last punch-out.
export default function PunchCard() {
  const dispatch = useDispatch();
  const { today, busy } = useSelector((state) => state.self);
  const [now, setNow] = useState(new Date());

  useEffect(() => { dispatch(fetchToday()); }, [dispatch]);

  // Tick every 30s so running totals stay current
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!today) {
    return <div className="bg-card border border-line rounded-lg p-5 mb-6 text-sm text-slate">Loading...</div>;
  }

  const { day, rules, holiday, isSunday } = today;
  const totals = liveTotals(day, now);
  const punchedIn = Boolean(day?.punchIn);
  const punchedOut = Boolean(day?.punchOut);
  const remaining = Math.max(0, rules.requiredMinutes - totals.totalMinutes);
  const act = (a) => dispatch(punchAction(a));

  let statusText = "Not punched in yet";
  if (punchedOut) statusText = `Punched out at ${fmtTime(day.punchOut)} — punch in again to continue (the time away counts as a break)`;
  else if (punchedIn) statusText = "Working";

  return (
    <div className="bg-card border border-line rounded-lg p-5 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2>Today's attendance</h2>
          <div className="text-xs text-slate">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {statusText}
            {holiday && <span className="text-brass"> · Holiday: {holiday.name}</span>}
            {isSunday && !holiday && <span className="text-brass"> · Sunday</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {punchedIn && !punchedOut ? (
            <button className="btn-primary !bg-rust" disabled={busy} onClick={() => act("punch-out")}>
              <LogOut size={15} /> Punch out
            </button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={() => act("punch-in")}>
              <LogIn size={15} /> Punch in
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="First punch in" value={fmtTime(day?.punchIn)} />
        <Stat label="Last punch out" value={fmtTime(day?.punchOut)} />
        <Stat label={`Break${day?.breaks?.length ? ` (${day.breaks.length})` : ""}`} value={fmtMinutes(totals.breakMinutes)} warn={totals.breakMinutes > rules.maxBreakMinutes} />
        <Stat label="Total" value={fmtMinutes(totals.totalMinutes)} warn={punchedOut && totals.totalMinutes < rules.requiredMinutes} />
        <Stat label={punchedOut ? "Required" : "Remaining"} value={fmtMinutes(punchedOut ? rules.requiredMinutes : remaining)} />
      </div>

      {totals.breakMinutes > rules.maxBreakMinutes && (
        <div className="text-xs text-rust mt-3">Break {fmtMinutes(rules.maxBreakMinutes)} exceeded — your manager will be notified by email.</div>
      )}
    </div>
  );
}
