// Names and colours shared by the recruitment screens
import type { CandidateSource, CandidateStage, EmploymentType, InterviewMode, JobStatus, OfferStatus, Recommendation } from "@/lib/types";

export const STAGES: { key: CandidateStage; label: string; tone: "neutral" | "info" | "warning" | "success" | "danger"; dot: string }[] = [
  { key: "applied", label: "Applied", tone: "neutral", dot: "bg-slate-400" },
  { key: "screening", label: "Screening", tone: "info", dot: "bg-sky-500" },
  { key: "interview", label: "Interview", tone: "warning", dot: "bg-amber-500" },
  { key: "offer", label: "Offer", tone: "info", dot: "bg-violet-500" },
  { key: "hired", label: "Hired", tone: "success", dot: "bg-emerald-500" },
  { key: "rejected", label: "Rejected", tone: "danger", dot: "bg-rose-500" },
];
export const stageOf = (k: CandidateStage) => STAGES.find((s) => s.key === k)!;

export const JOB_STATUS: Record<JobStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Open", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
};

export const EMPLOYMENT: Record<EmploymentType, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", intern: "Internship" };
export const SOURCES: Record<CandidateSource, string> = { referral: "Referral", linkedin: "LinkedIn", naukri: "Naukri", website: "Website", walk_in: "Walk-in", agency: "Agency", other: "Other" };
export const MODES: Record<InterviewMode, string> = { video: "Video call", in_person: "In person", phone: "Phone" };
export const RECOMMEND: Record<Recommendation, { label: string; tone: "success" | "danger" }> = {
  strong_yes: { label: "Strong yes", tone: "success" },
  yes: { label: "Yes", tone: "success" },
  no: { label: "No", tone: "danger" },
  strong_no: { label: "Strong no", tone: "danger" },
};
export const OFFER_STATUS: Record<OfferStatus, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const options = <K extends string>(map: Record<K, string | { label: string }>) =>
  (Object.entries(map) as [K, string | { label: string }][]).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

// ₹12,00,000 → "12 L"; small numbers stay as rupees
export const lakhs = (v: string | number | null | undefined) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} L` : `₹${n.toLocaleString("en-IN")}`;
};
