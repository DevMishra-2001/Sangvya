// Labels and colors shared by several screens. A color is always shown next
// to its text label, never as the only cue.
import type { CandidateStage, DayFlag, DocumentCategory, EmployeeStatus, EmploymentType, ExitReason } from "./types";

export const ATTENDANCE_FLAGS: { key: DayFlag; label: string; color: string }[] = [
  { key: "online", label: "Online", color: "#16a34a" },
  { key: "offline", label: "Offline", color: "#dc2626" },
  { key: "leave_off", label: "Leave/Off", color: "#ea7317" },
  { key: "missing", label: "Missing Attendance", color: "#7c3aed" },
  { key: "short", label: "Short Attendance", color: "#0891b2" },
  { key: "forced_short", label: "Forcefully Short Attendance", color: "#2563eb" },
  { key: "long_break", label: "Long Break", color: "#eab308" },
  { key: "forced_long_break", label: "Forcefully Long Break", color: "#9333ea" },
];
export const FLAG_META = Object.fromEntries(ATTENDANCE_FLAGS.map((f) => [f.key, f])) as Record<DayFlag, (typeof ATTENDANCE_FLAGS)[number]>;

export const LOCATION_LABELS: Record<string, string> = {
  office: "Office",
  client_site: "Client Site",
  remote: "Work from home",
  office_client: "Office + Client",
  other: "Other",
};
export const LOCATION_OPTIONS = Object.entries(LOCATION_LABELS).map(([value, label]) => ({ value, label }));

export const CANDIDATE_STAGES: { key: CandidateStage; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
];

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  intern: "Intern",
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = { active: "Active", notice: "On notice", exited: "Left" };

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  resigned: "Resigned",
  terminated: "Terminated",
  retired: "Retired",
  contract_end: "Contract ended",
  absconded: "Absconded",
  other: "Other",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  pan_card: "PAN card",
  aadhaar: "Aadhaar card",
  passport: "Passport",
  photo: "Passport photo",
  id_proof: "Other ID proof",
  address_proof: "Address proof",
  education: "Education certificate",
  experience: "Previous company letter",
  previous_payslip: "Previous payslip",
  bank_proof: "Bank passbook / cheque",
  offer_letter: "Offer letter",
  contract: "Contract",
  payslip: "Payslip",
  other: "Other",
};

// Documents asked for at joining (onboarding link + profile checklist)
export const JOINING_DOCUMENTS: DocumentCategory[] = ["pan_card", "aadhaar", "photo", "education", "experience", "previous_payslip", "bank_proof"];

export const MARITAL_STATUS_LABELS = { single: "Single", married: "Married", divorced: "Divorced", widowed: "Widowed" } as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const WORK_MODE_LABELS = { office: "Office", remote: "Remote", hybrid: "Hybrid", field: "Field" } as const;
export const RELATION_LABELS = { father: "Father", mother: "Mother", spouse: "Spouse", sibling: "Brother / Sister", child: "Son / Daughter", friend: "Friend", other: "Other" } as const;
export const ACCOUNT_TYPE_LABELS = { savings: "Savings", current: "Current", salary: "Salary" } as const;
export const GENDER_LABELS = { male: "Male", female: "Female", other: "Other" } as const;

const options = <K extends string>(labels: Record<K, string>) => (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
export const EMPLOYMENT_TYPE_OPTIONS = options(EMPLOYMENT_TYPE_LABELS);
export const EXIT_REASON_OPTIONS = options(EXIT_REASON_LABELS);
export const DOCUMENT_CATEGORY_OPTIONS = options(DOCUMENT_CATEGORY_LABELS);
export const MARITAL_STATUS_OPTIONS = options(MARITAL_STATUS_LABELS);
export const BLOOD_GROUP_OPTIONS = BLOOD_GROUPS.map((g) => ({ value: g, label: g }));
export const WORK_MODE_OPTIONS = options(WORK_MODE_LABELS);
export const RELATION_OPTIONS = options(RELATION_LABELS);
export const ACCOUNT_TYPE_OPTIONS = options(ACCOUNT_TYPE_LABELS);
export const GENDER_OPTIONS = options(GENDER_LABELS);
