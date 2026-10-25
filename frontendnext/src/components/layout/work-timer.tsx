"use client";

import { useEffect, useState } from "react";
import { PunchDetailsDialog } from "@/components/attendance/punch-details-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtMinutes, hhmm, isoDate, liveTotals } from "@/lib/format";
import { isUserActive } from "@/lib/session/activity";
import { useAuthStore, useCan } from "@/stores/auth-store";
import { useSelfStore } from "@/stores/self-store";

const STATES = {
  idle: { label: "Not punched in", color: "var(--muted-foreground)" },
  working: { label: "Working", color: "var(--primary)" },
  break: { label: "On break", color: "var(--warning)" }, // punched out — the clock keeps running
};

// Header (center): today's time since punch-in as HH:MM; the pill's track fills
// towards the required hours and its border blinks while the day runs.
export function WorkTimer() {
  const can = useCan();
  const employeeId = useAuthStore((s) => s.user?.employee_id);
  const today = useSelfStore((s) => s.today);
  const loadToday = useSelfStore((s) => s.loadToday);
  // Read the clock in the browser only
  const [now, setNow] = useState<Date | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const enabled = can("attendance.self") && Boolean(employeeId);

  // Load today's record and refresh it every 5 min, only while the user is active
  useEffect(() => {
    if (!enabled) return;
    loadToday();
    const t = setInterval(() => {
      if (isUserActive(5 * 60000)) loadToday();
    }, 5 * 60000);
    return () => clearInterval(t);
  }, [enabled, loadToday]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  if (!enabled || !today || !now) return null;

  const { day, rules } = today;
  const required = rules.requiredMinutes;
  const punchedIn = Boolean(day?.punchIn);
  const punchedOut = Boolean(day?.punchOut);
  // After a punch-out today, the time away counts as a break until the next punch-in
  let { totalMinutes, breakMinutes } = liveTotals(day, now);
  if (punchedOut && today.date === isoDate(now) && day?.punchOut) {
    const away = Math.max(0, Math.floor((now.getTime() - new Date(day.punchOut).getTime()) / 60000));
    totalMinutes += away;
    breakMinutes += away;
  }
  const state = STATES[!punchedIn ? "idle" : punchedOut ? "break" : "working"];
  const pct = Math.min(1, totalMinutes / required);

  // Pill track starting top-center, clockwise. pathLength=100 → dash offset is a percentage.
  const W = 96, H = 34, stroke = 3, inset = 4.5;
  const R = (H - 2 * inset) / 2;
  const [left, right, top, bottom] = [inset, W - inset, inset, H - inset];
  const pill = `M ${W / 2} ${top} H ${right - R} A ${R} ${R} 0 0 1 ${right - R} ${bottom} H ${left + R} A ${R} ${R} 0 0 1 ${left + R} ${top} Z`;

  const tip = punchedIn
    ? `${state.label} · ${fmtMinutes(totalMinutes)} of ${fmtMinutes(required)} · breaks ${fmtMinutes(breakMinutes)}${totalMinutes < required ? ` · ${fmtMinutes(required - totalMinutes)} left` : ""}`
    : `Not punched in yet · target ${fmtMinutes(required)}`;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            aria-label={`Worked today ${hhmm(totalMinutes)}. ${tip}. Open punch details`}
            className="relative flex items-center justify-center rounded-full bg-card outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: W, height: H }}
          >
            <span className="absolute inset-0 rounded-full border-2" style={{ borderColor: state.color, animation: "ring-blink 3s ease-in-out infinite" }} aria-hidden />
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
              <path d={pill} fill="none" strokeWidth={stroke} style={{ stroke: "var(--border)" }} />
              {pct > 0 && (
                <path
                  d={pill}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="100"
                  strokeDashoffset={100 * (1 - pct)}
                  style={{ stroke: state.color, transition: "stroke-dashoffset 0.7s ease" }}
                />
              )}
            </svg>
            <span className="relative text-sm leading-none font-bold tabular-nums">{hhmm(totalMinutes)}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{tip} · click for punch details</TooltipContent>
      </Tooltip>
      <PunchDetailsDialog open={showDetails} onOpenChange={setShowDetails} />
    </>
  );
}
