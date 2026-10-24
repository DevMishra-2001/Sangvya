import { useEffect, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyLeaves } from "../../store/slices/selfSlice";
import AttendanceTabs, { PageStrip } from "../../components/attendance/AttendanceTabs";
import { DataTable } from "../../components/Table";
import { Input, DatePicker, ReactSelect, Button } from "../../components/formComponent";
import Tooltip from "../../components/Tooltip";
import { LEAVE_TYPE_LABELS } from "../../utils/workday";
import { toMonth, monthLabel } from "../../utils/attendanceMeta";

const SEARCH_TYPES = [
  { value: "all", label: "All" },
  { value: "none", label: "No Leaves" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
];

// Legend: dot + label (color is never the only cue)
const LEGEND = [
  { key: "none", label: "No-Leave", dot: "border border-slate bg-transparent" },
  { key: "pending", label: "Pending", dot: "bg-rust/60" },
  { key: "approved", label: "Approved", dot: "bg-leaf" },
];

const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// Day numbers a leave covers inside the month, e.g. "03,17"
function dayNumbers(leaves) {
  const days = new Set();
  leaves.forEach((l) => {
    for (let d = new Date(`${l.monthFrom}T00:00:00`); d <= new Date(`${l.monthTo}T00:00:00`); d.setDate(d.getDate() + 1)) {
      days.add(String(d.getDate()).padStart(2, "0"));
    }
  });
  return [...days].sort().join(",");
}

function DetailsModal({ month, leaves, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal !w-[640px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2>Leaves — {monthLabel(month)}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {leaves.length === 0 ? (
          <div className="text-sm text-slate">No leaves this month.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Description</th><th>Status</th><th>By</th></tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td>{LEAVE_TYPE_LABELS[l.leave_type] || "Leave"}</td>
                  <td className="tabular-nums whitespace-nowrap">{fmtDay(l.from_date)}</td>
                  <td className="tabular-nums whitespace-nowrap">{fmtDay(l.to_date)}</td>
                  <td className="tabular-nums">{l.days}</td>
                  <td>{l.reason || "—"}</td>
                  <td><span className={`status-pill status-${l.status}`}>{l.status}</span></td>
                  <td>{l.reviewed_by_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate mt-3">Pending leaves are approved or rejected by your reporting manager.</p>
      </div>
    </div>
  );
}

// My Attendance → Leave View Approval: the employee's own leaves for a month
// and their approval status (decisions are made by the reporting manager).
export default function LeaveViewApprovalPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const leaves = useSelector((state) => state.self.leaves);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [searchType, setSearchType] = useState("all");
  const [filter, setFilter] = useState("all"); // applied on Search
  const [showDetails, setShowDetails] = useState(false);

  function search() {
    if (!monthDate) return;
    dispatch(fetchMyLeaves(toMonth(monthDate)));
    setFilter(searchType);
  }

  useEffect(() => {
    if (user.employee_id) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employee_id]);

  if (!user.employee_id) {
    return (
      <div>
        <AttendanceTabs />
        <div className="empty-state">Your login isn't linked to an employee record — please ask HR to link it.</div>
      </div>
    );
  }

  const month = leaves?.month;
  const active = (leaves?.leaves || []).filter((l) => l.status !== "rejected");
  const pending = active.filter((l) => l.status === "pending");
  const approved = active.filter((l) => l.status === "approved");
  const state = active.length === 0 ? "none" : pending.length ? "pending" : "approved";

  // The month row, built from the leaves the filter keeps
  const shownLeaves = filter === "pending" ? pending : filter === "approved" ? approved : active;
  const visible =
    month &&
    (filter === "all" || (filter === "none" ? active.length === 0 : shownLeaves.length > 0));
  const rows = visible
    ? [{
        id: month,
        month: monthLabel(month),
        name: leaves.employee.name,
        days: shownLeaves.reduce((s, l) => s + l.days, 0),
        dates: dayNumbers(shownLeaves) || "—",
        description: [...new Set(shownLeaves.map((l) => l.reason || LEAVE_TYPE_LABELS[l.leave_type]))].join(", ") || "—",
        state,
      }]
    : [];

  const columns = [
    { key: "sno", label: "S.No.", sortable: true, render: (_, i) => i + 1 },
    { key: "month", label: "Month-Year", sortable: true },
    { key: "name", label: "Employee Name", sortable: true },
    { key: "days", label: "NoOfDays", sortable: true, className: "tabular-nums" },
    { key: "dates", label: "Leave Date", sortable: true, className: "tabular-nums" },
    { key: "description", label: "Description", sortable: true },
    {
      key: "edit",
      label: "Edit",
      render: () => (
        <Tooltip content="View leave details" placement="left">
          <button type="button" onClick={() => setShowDetails(true)} className="p-1 rounded text-ink hover:bg-ink/10" aria-label="View leave details">
            <ClipboardList size={16} />
          </button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <AttendanceTabs />

      <div className="bg-card border border-line rounded-xl mb-4">
        <PageStrip title="HR / Leave View Approval">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-ink">
            {LEGEND.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                {l.label}
              </span>
            ))}
            <span>Total Record : {rows.length}</span>
          </div>
        </PageStrip>
        <div className="flex flex-wrap items-start gap-4 px-4 pt-5 pb-4">
          <Input id="lvaEmployee" lable="Employee" value={leaves?.employee?.name || user.name} readOnly respclass="w-72" removeFormGroupClass />
          <DatePicker id="lvaMonth" name="month" lable="Month" viewDate="month" value={monthDate} handleChange={(e) => setMonthDate(e.target.value)} respclass="w-60" removeFormGroupClass />
          <ReactSelect
            id="lvaType"
            name="searchType"
            placeholderName="SearchType"
            dynamicOptions={SEARCH_TYPES}
            value={searchType}
            handleChange={(_, option) => setSearchType(option?.value || "all")}
            removeIsClearable
            respclass="w-72"
          />
          <Button name="Search" className="btn-primary h-8 !py-0" handleClick={search} />
        </div>
      </div>

      <DataTable
        title="Search Details"
        columns={columns}
        rows={rows}
        rowKey="id"
        searchKeys={["name"]}
        searchPlaceholder="Search By Name"
        rowClassName={(r) => (r.state === "pending" ? "bg-rustbg" : r.state === "approved" ? "bg-leafbg" : "")}
        emptyText="No records for this filter."
      />

      {showDetails && month && <DetailsModal month={month} leaves={leaves.leaves} onClose={() => setShowDetails(false)} />}
    </div>
  );
}
