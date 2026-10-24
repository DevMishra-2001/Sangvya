import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchJobs, fetchCandidates } from "../store/slices/recruitmentSlice";
import { JobList, JobFormModal } from "../components/recruitment/JobPostings";
import CandidateBoard from "../components/recruitment/CandidateBoard";
import CandidateFormModal from "../components/recruitment/CandidateFormModal";
import useCan from "../hooks/useCan";

export default function RecruitmentPage() {
  const dispatch = useDispatch();
  const can = useCan();
  const { jobs, candidates } = useSelector((state) => state.recruitment);
  const [tab, setTab] = useState("jobs"); // jobs | candidates
  const [showJobForm, setShowJobForm] = useState(false);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    dispatch(fetchJobs());
    dispatch(fetchCandidates());
  }, [dispatch]);

  const visibleCandidates = selectedJobId
    ? candidates.filter((c) => c.job_posting_id === selectedJobId)
    : candidates;

  return (
    <div>
      <div className="mb-5">
        <h1>Recruitment</h1>
      </div>

      <div className="flex gap-1 mb-4.5 border-b border-line">
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "jobs" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("jobs")}
        >
          Job Postings
        </button>
        <button
          className={`px-4 py-2.5 bg-transparent border-none border-b-2 text-sm cursor-pointer ${tab === "candidates" ? "text-ink font-semibold border-brass" : "text-slate border-transparent"}`}
          onClick={() => setTab("candidates")}
        >
          Candidates
        </button>
      </div>

      {tab === "jobs" && (
        <>
          {can("recruitment.manage") && <div className="flex justify-end mb-4">
            <button className="btn-primary" onClick={() => setShowJobForm(true)}>
              <Plus size={15} /> New job
            </button>
          </div>}
          <JobList jobs={jobs} onSelect={(id) => { setSelectedJobId(id); setTab("candidates"); }} selectedJobId={selectedJobId} />
          {showJobForm && <JobFormModal onClose={() => setShowJobForm(false)} />}
        </>
      )}

      {tab === "candidates" && (
        <>
          <div className="flex justify-between items-center mb-4">
            {selectedJobId ? (
              <button className="text-sm text-brass" onClick={() => setSelectedJobId(null)}>
                ← Show all candidates
              </button>
            ) : <span />}
            <button className="btn-primary" onClick={() => setShowCandidateForm(true)} disabled={jobs.length === 0}>
              <Plus size={15} /> Add candidate
            </button>
          </div>
          <CandidateBoard candidates={visibleCandidates} />
          {showCandidateForm && (
            <CandidateFormModal jobs={jobs} defaultJobId={selectedJobId} onClose={() => setShowCandidateForm(false)} />
          )}
        </>
      )}
    </div>
  );
}
