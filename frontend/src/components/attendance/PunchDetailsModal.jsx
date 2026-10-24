import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { fetchDayDetails } from "../../store/slices/selfSlice";
import { DataTable } from "../Table";
import { Input, DatePicker } from "../formComponent";
import { isoDate } from "../../utils/workday";

// "11:35:36"
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour12: false }) : "00:00:00");
// seconds → "01:12:36"
const hms = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
const secondsBetween = (a, b) => (new Date(b) - new Date(a)) / 1000;
const ddmmyyyy = (date) => date.split("-").reverse().join("-");

function Section({ title, right, children, footerLabel, footerValue }) {
  return (
    <section className="border border-line rounded-lg overflow-hidden mt-2.5 text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border-b border-primary/20">
        <h3 className="text-xs font-semibold text-ink">{title}</h3>
        {right && <span className="text-xs font-semibold text-ink">{right}</span>}
      </div>
      {children}
      <div className="text-right px-3 py-1.5 text-xs font-semibold text-ink">
        {footerLabel} : <span className="text-rust tabular-nums">{footerValue}</span>
      </div>
    </section>
  );
}

// Opened from the header timer: the day's breaks and in/out punches, to the second.
export default function PunchDetailsModal({ onClose }) {
  const dispatch = useDispatch();
  const [date, setDate] = useState(() => new Date());
  const [data, setData] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!date) return;
    setData(null);
    dispatch(fetchDayDetails(isoDate(date))).then((r) => { if (!r.error) setData(r.payload); });
  }, [dispatch, date]);

  // Keep an open session's running time current
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const day = data?.day;
  const isToday = data && data.date === data.today;
  // An open session/break on a past day is measured to its last punch, not "now"
  const endOf = (iso) => iso || (isToday ? now : day?.punchOut || iso);

  const breakRows = (day?.breaks || []).map((b, i) => ({
    id: i,
    sno: i + 1,
    in: clock(b.start),
    out: b.end ? clock(b.end) : "00:00:00",
    seconds: b.end || isToday ? secondsBetween(b.start, endOf(b.end)) : 0,
  }));
  const ioRows = (day?.sessions || []).map((s, i) => ({
    id: i,
    sno: i + 1,
    date: ddmmyyyy(data.date),
    in: clock(s.in),
    out: s.out ? clock(s.out) : "00:00:00",
    seconds: s.out || isToday ? secondsBetween(s.in, endOf(s.out)) : 0,
  }));
  const totalBreak = breakRows.reduce((sum, r) => sum + r.seconds, 0);
  const totalWork = ioRows.reduce((sum, r) => sum + r.seconds, 0);

  const breakColumns = [
    { key: "sno", label: "S.No.", sortable: true },
    { key: "in", label: "BreakIn", sortable: true, className: "tabular-nums" },
    { key: "out", label: "BreakOut", sortable: true, className: "tabular-nums" },
    { key: "seconds", label: "BreakDuration", sortable: true, className: "tabular-nums", render: (r) => hms(r.seconds) },
  ];
  const ioColumns = [
    { key: "sno", label: "S.No.", sortable: true },
    { key: "date", label: "Date", sortable: true, className: "tabular-nums" },
    { key: "in", label: "IN", sortable: true, className: "tabular-nums" },
    { key: "out", label: "OUT", sortable: true, className: "tabular-nums" },
    { key: "seconds", label: "Time Difference", sortable: true, className: "tabular-nums", render: (r) => hms(r.seconds) },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Details"
        className="bg-card rounded-xl w-[560px] max-w-[95vw] max-h-[80vh] overflow-hidden flex flex-col"
        style={{ boxShadow: "var(--shadow-pop)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-primary text-primaryfg">
          <h2 className="!mb-0 !text-sm font-sans font-semibold text-primaryfg">Search Details</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-white/15">
            <X size={16} />
          </button>
        </div>

        <div className="p-3 overflow-y-auto">
          <div className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold text-ink">
            Employee Code:- {data?.employee?.code || "—"}
          </div>

          <div className="flex flex-wrap items-start gap-3 pt-4">
            <Input id="pdEmployee" lable="Employee" value={data?.employee?.name || ""} readOnly respclass="w-48" removeFormGroupClass />
            <DatePicker id="pdDate" name="date" lable="Date" value={date} handleChange={(e) => setDate(e.target.value)} maxDate={new Date()} respclass="w-48" removeFormGroupClass />
          </div>

          {!data ? (
            <div className="text-sm text-slate mt-4">Loading…</div>
          ) : (
            <>
              <Section title="Break Details" right={`Break Count: ${breakRows.length}`} footerLabel="Total Break Duration" footerValue={hms(totalBreak)}>
                <DataTable columns={breakColumns} rows={breakRows} rowKey="id" showSummary={false} pageSize={50} compact emptyText="No breaks on this day." />
              </Section>
              <Section title="In-Out Details" footerLabel="Total Working Hours" footerValue={hms(totalWork)}>
                <DataTable columns={ioColumns} rows={ioRows} rowKey="id" showSummary={false} pageSize={50} compact emptyText="No punches on this day." />
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
