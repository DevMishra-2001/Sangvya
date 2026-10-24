import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEmployees } from "../store/slices/employeesSlice";
import { fetchCycles, fetchReviewsForCycle } from "../store/slices/performanceSlice";
import { CycleList, CycleFormModal } from "../components/performance/ReviewCycles";
import { ReviewTable, ReviewFormModal } from "../components/performance/ReviewForm";
import useCan from "../hooks/useCan";

export default function PerformancePage() {
  const dispatch = useDispatch();
  const can = useCan();
  const employees = useSelector((state) => state.employees.list);
  const { cycles, reviewsByCycle } = useSelector((state) => state.performance);
  const [tab, setTab] = useState("cycles"); // cycles | reviews
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // { employee, existing }

  useEffect(() => {
    dispatch(fetchEmployees());
    dispatch(fetchCycles());
  }, [dispatch]);

  useEffect(() => {
    if (selectedCycleId) dispatch(fetchReviewsForCycle(selectedCycleId));
  }, [dispatch, selectedCycleId]);

  const reviews = reviewsByCycle[selectedCycleId] || [];

  return (
    <div>
      <div className="mb-5">
        <h1>Performance Review</h1>
      </div>

      <div className="flex gap-1 mb-4.5 border-b border-line">
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "cycles" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("cycles")}
        >
          Review Cycles
        </button>
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "reviews" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("reviews")}
          disabled={!selectedCycleId}
        >
          Reviews {selectedCycleId ? `— ${cycles.find((c) => c.id === selectedCycleId)?.name || ""}` : ""}
        </button>
      </div>

      {tab === "cycles" && (
        <>
          {can("performance.manageCycles") && <div className="flex justify-end mb-4">
            <button className="btn-primary" onClick={() => setShowCycleForm(true)}>
              <Plus size={15} /> New cycle
            </button>
          </div>}
          <CycleList
            cycles={cycles}
            selectedCycleId={selectedCycleId}
            onSelect={(id) => { setSelectedCycleId(id); setTab("reviews"); }}
          />
          {showCycleForm && <CycleFormModal onClose={() => setShowCycleForm(false)} />}
        </>
      )}

      {tab === "reviews" && selectedCycleId && (
        <ReviewTable
          employees={employees}
          reviews={reviews}
          cycleId={selectedCycleId}
          onEdit={(employee, existing) => setReviewTarget({ employee, existing })}
        />
      )}

      {reviewTarget && (
        <ReviewFormModal
          employee={reviewTarget.employee}
          existing={reviewTarget.existing}
          cycleId={selectedCycleId}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
}
