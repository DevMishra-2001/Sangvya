import { UserCheck, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";
import { updateCandidateStage, deleteCandidate, convertToEmployee } from "../../store/slices/recruitmentSlice";
import useCan from "../../hooks/useCan";

const STAGES = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
];

export default function CandidateBoard({ candidates }) {
  const dispatch = useDispatch();
  const canManage = useCan()("recruitment.manage");

  if (candidates.length === 0) {
    return <div className="empty-state">No candidates yet. Click "Add candidate" to get started.</div>;
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {STAGES.map((stage) => {
        const inStage = candidates.filter((c) => c.stage === stage.key);
        return (
          <div key={stage.key} className="flex flex-col gap-2 min-w-[160px]">
            <div className="text-xs font-medium text-slate uppercase tracking-wide px-1">
              {stage.label} ({inStage.length})
            </div>
            {inStage.map((c) => (
              <div key={c.id} className="bg-card border border-line rounded-lg p-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate mt-0.5">{c.job_title}</div>
                {c.email && <div className="text-xs text-slate mt-1 truncate">{c.email}</div>}

                <select
                  value={c.stage}
                  onChange={(e) => dispatch(updateCandidateStage({ id: c.id, stage: e.target.value }))}
                  className="w-full mt-2 text-xs border border-line rounded-md px-2 py-1.5"
                >
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>

                <div className="flex items-center justify-between mt-2">
                  {c.stage === "hired" && canManage ? (
                    <button
                      onClick={() => dispatch(convertToEmployee(c.id))}
                      className="flex items-center gap-1 text-xs text-leaf"
                      title="Add to Employees"
                    >
                      <UserCheck size={13} /> Add to Employees
                    </button>
                  ) : <span />}
                  {canManage && <button onClick={() => dispatch(deleteCandidate(c.id))} className="p-1 text-slate hover:text-rust">
                    <Trash2 size={13} />
                  </button>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
