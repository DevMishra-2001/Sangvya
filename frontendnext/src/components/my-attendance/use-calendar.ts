"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { run } from "@/lib/api/run";
import { isoDate } from "@/lib/format";
import { selfService } from "@/lib/services/self";
import type { AttendanceDay, CalendarResponse, Holiday, Leave } from "@/lib/types";

export interface CalendarEntry {
  day: AttendanceDay | null;
  holiday: Holiday | null;
  leaves: Leave[];
}

// A month of my attendance + holidays + leaves, indexed by date
export function useCalendar(month: string, enabled: boolean) {
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    run(() => selfService.calendar(month)).then((result) => {
      if (!cancelled && result.ok) setCalendar(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [month]);

  useEffect(() => {
    if (enabled) return reload();
  }, [enabled, reload]);

  const byDate = useMemo(() => {
    const map: Record<string, CalendarEntry> = {};
    if (!calendar || calendar.month !== month) return map;
    const entry = (d: string) => (map[d] ??= { day: null, holiday: null, leaves: [] });
    calendar.days.forEach((d) => (entry(d.date).day = d));
    calendar.holidays.forEach((h) => (entry(h.date).holiday = h));
    calendar.leaves.forEach((l) => {
      for (let d = new Date(`${l.from_date}T00:00:00`); isoDate(d) <= l.to_date; d.setDate(d.getDate() + 1)) {
        if (isoDate(d).startsWith(month)) entry(isoDate(d)).leaves.push(l);
      }
    });
    return map;
  }, [calendar, month]);

  return { calendar: calendar?.month === month ? calendar : null, byDate, reload };
}
