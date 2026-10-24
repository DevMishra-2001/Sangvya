import { Check, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { updateLeaveStatus } from "../../store/slices/leaveSlice";
import { SHORT_LEAVE_LABELS } from "../../utils/workday";

// canApprove: role holds "leave.approve". A user can never act on their own leave.
export default function LeaveList({ leaves, canApprove, myEmployeeId }) {
  const dispatch = useDispatch();

  if (leaves.length === 0) return <div className="empty-state">No leave requests yet.</div>;

  return (
    <div className="flex flex-col gap-2.5">
      {leaves.map((l) => (
        <div key={l.id} className="bg-card border border-line rounded-lg px-4.5 py-3.5 flex justify-between items-center">
          <div>
            <div className="text-sm mb-0.5">
              {l.employee_name}
              <span className="ml-2 text-2xs px-1.5 py-0.5 rounded bg-ivory border border-line text-slate">{SHORT_LEAVE_LABELS[l.leave_type] || "Leave"}</span>
            </div>
            <div className="text-xs text-slate">
              {l.from_date?.slice(0, 10)} → {l.to_date?.slice(0, 10)} {l.reason && `· ${l.reason}`}
            </div>
          </div>
          {l.status === "pending" && canApprove && l.employee_id !== myEmployeeId ? (
            <div className="flex gap-2">
              <button
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-leaf text-leaf bg-transparent cursor-pointer"
                onClick={() => dispatch(updateLeaveStatus({ id: l.id, status: "approved" }))}
              >
                <Check size={13} /> Approve
              </button>
              <button
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-rust text-rust bg-transparent cursor-pointer"
                onClick={() => dispatch(updateLeaveStatus({ id: l.id, status: "rejected" }))}
              >
                <X size={13} /> Reject
              </button>
            </div>
          ) : (
            <span className={`status-pill status-${l.status}`}>{l.status}</span>
          )}
        </div>
      ))}
    </div>
  );
}
