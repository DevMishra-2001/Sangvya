import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchToday } from "../../store/slices/selfSlice";
import { liveTotals, fmtMinutes, isoDate } from "../../utils/workday";
import useCan from "../../hooks/useCan";
import { isUserActive } from "../../session/activity";
import Tooltip from "../Tooltip";
import PunchDetailsModal from "../attendance/PunchDetailsModal";

// 205 → "03:25"
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Ring color per state (theme variables, so it works in light & dark).
const STATES = {
  idle:     { label: "Not punched in", color: "rgb(var(--color-slate))", blink: true },
  working:  { label: "Working",        color: "rgb(var(--color-primary))", blink: true },
  break:    { label: "On break",       color: "rgb(var(--color-gold))", blink: true }, // punched out — clock keeps running
};

// Header (center): an oval timer — today's time since punch-in as HH:MM, the
// track fills towards the required 9h, and its outer border blinks while the day runs.
export default function WorkTimer() {
  const dispatch = useDispatch();
  const can = useCan();
  const user = useSelector((state) => state.auth.user);
  const today = useSelector((state) => state.self.today);
  const [now, setNow] = useState(new Date());
  const [showDetails, setShowDetails] = useState(false);
  const enabled = can("attendance.self") && Boolean(user?.employee_id);

  // Load today's record, refresh it every 5 min (catches a new day / punches from another device)
  useEffect(() => {
    if (!enabled) return;
    dispatch(fetchToday());
    // Polls only while the user is active, so an idle tab doesn't keep the session alive
    const t = setInterval(() => { if (isUserActive(5 * 60000)) dispatch(fetchToday()); }, 5 * 60000);
    return () => clearInterval(t);
  }, [dispatch, enabled]);

  // Tick every 30s so the running time stays current
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!enabled || !today) return null;

  const { day, rules } = today;
  const required = rules.requiredMinutes;
  const punchedIn = Boolean(day?.punchIn);
  const punchedOut = Boolean(day?.punchOut);
  // After a punch-out today the clock keeps running: the time away is a break
  // until the employee punches in again (or the day ends).
  const runningBreak = punchedOut && today.date === isoDate(now);
  let { totalMinutes, breakMinutes } = liveTotals(day, now);
  if (runningBreak) {
    const away = Math.max(0, Math.floor((now - new Date(day.punchOut)) / 60000));
    totalMinutes += away;
    breakMinutes += away;
  }
  const key = !punchedIn ? "idle" : punchedOut ? "break" : "working";
  const state = STATES[key];
  const pct = Math.min(1, totalMinutes / required);

  // Oval (pill) track: starts at top-center and runs clockwise, like a clock.
  // pathLength=100 lets the dash offset be a plain percentage.
  const W = 96, H = 34, stroke = 3, inset = 4.5;
  const R = (H - 2 * inset) / 2;
  const [left, right, top, bottom] = [inset, W - inset, inset, H - inset];
  const pill = `M ${W / 2} ${top} H ${right - R} A ${R} ${R} 0 0 1 ${right - R} ${bottom} H ${left + R} A ${R} ${R} 0 0 1 ${left + R} ${top} Z`;

  const tip = punchedIn
    ? `${state.label} · ${fmtMinutes(totalMinutes)} of ${fmtMinutes(required)} · breaks ${fmtMinutes(breakMinutes)}${
        totalMinutes < required ? ` · ${fmtMinutes(required - totalMinutes)} left` : ""
      }`
    : `Not punched in yet · target ${fmtMinutes(required)}`;
  const tipText = `${tip} · click for punch details`;

  return (
    <>
    <Tooltip content={tipText} placement="bottom">
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        aria-label={`Worked today ${hhmm(totalMinutes)}. ${tip}. Open punch details`}
        className="relative rounded-full bg-card flex items-center justify-center cursor-pointer hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ width: W, height: H }}
      >
        {/* Blinking outer border */}
        <span
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: state.color,
            animation: state.blink ? "ring-blink 3s ease-in-out infinite" : "none",
          }}
          aria-hidden
        />
        {/* Track + progress towards the required hours */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
          <path d={pill} fill="none" strokeWidth={stroke} style={{ stroke: "rgb(var(--color-line))" }} />
          {pct > 0 && (
            <path
              d={pill} fill="none" strokeWidth={stroke} strokeLinecap="round" pathLength={100}
              strokeDasharray="100" strokeDashoffset={100 * (1 - pct)}
              style={{ stroke: state.color, transition: "stroke-dashoffset 0.7s ease" }}
            />
          )}
        </svg>
        <span className="relative text-sm font-bold text-ink tabular-nums leading-none">{hhmm(totalMinutes)}</span>
      </button>
    </Tooltip>
    {/* Portal: the header's backdrop-blur would otherwise trap the fixed overlay inside the header */}
    {showDetails && createPortal(<PunchDetailsModal onClose={() => setShowDetails(false)} />, document.body)}
    </>
  );
}
