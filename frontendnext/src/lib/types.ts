// Shapes of the backend's responses. Rows come straight from the database, so
// their fields are snake_case; computed / composed objects are camelCase.
import type { Permission, Role } from "./permissions";

export type Id = number;
export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string; // ISO timestamp

// ---- Auth ----
export interface User {
  id: Id;
  company_id: Id | null; // null until a new superadmin creates their company
  employee_id: Id | null;
  name: string;
  email: string;
  role: Role;
  font_size: number;
  created_at: ISODateTime;
  permissions: Permission[];
}

// My own employee record (profile panel)
export interface MyProfile {
  id: Id;
  name: string;
  email: string | null;
  code: string | null;
  designation: string | null;
  department: string | null;
  joinDate: ISODate | null;
  dateOfBirth: ISODate | null;
  photoUrl: string | null;
  manager: { id: Id; name: string } | null;
}

export interface SessionInfo {
  accessTtlMin: number;
  idleMin: number;
}

export interface Company {
  id: Id;
  name: string;
  industry: string | null;
  logo_url: string | null;
  employee_range?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

export interface CompanyListItem extends Pick<Company, "id" | "name" | "industry" | "logo_url"> {
  current: boolean;
}

export interface AuthResponse {
  user: User;
  company: Company | null;
  session: SessionInfo;
}

// ---- Designations ----
export interface Designation {
  id: Id;
  name: string;
  employee_count: number;
}

// ---- Users & roles ----
export interface UserRow {
  id: Id;
  company_id: Id;
  employee_id: Id | null;
  name: string;
  email: string;
  role: Role;
  created_at: ISODateTime;
  employee_name: string | null;
}

// ---- Employees ----
export interface Employee {
  id: Id;
  company_id: Id;
  name: string;
  designation_id: Id | null;
  designation: string | null; // the designation's name
  department: string | null;
  email: string | null;
  join_date: ISODate | null;
  salary: string | null;
  manager_id: Id | null;
  date_of_birth: ISODate | null;
  ol_quota: string | null;
  employee_code: string | null;
  photo_url: string | null;
  created_at: ISODateTime;
}

// ---- Attendance (HR) ----
export type AttendanceStatus = "present" | "absent" | "half";

export interface AttendanceRow {
  id: Id;
  employee_id: Id;
  date: ISODate;
  status: AttendanceStatus;
  employee_name?: string;
}

// ---- Self-service attendance ----
// Where a punch happened, from the browser's GPS (null if not shared)
export interface PunchGeo {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export interface WorkSession {
  in: ISODateTime;
  inLocation: string | null;
  inRemarks: string | null;
  inGeo: PunchGeo | null;
  inPhoto: string | null;
  out: ISODateTime | null;
  outLocation: string | null;
  outRemarks: string | null;
  outGeo: PunchGeo | null;
  outPhoto: string | null;
}

export interface AttendanceDay {
  id: Id;
  date: ISODate;
  status: string;
  punchIn: ISODateTime | null;
  punchOut: ISODateTime | null;
  punchInLocation: string | null;
  punchInRemarks: string | null;
  punchOutLocation: string | null;
  punchOutRemarks: string | null;
  breaks: { start: ISODateTime; end: ISODateTime | null }[];
  sessions: WorkSession[];
  totalMinutes: number;
  breakMinutes: number;
  workMinutes: number;
  onBreak: boolean;
  shortDay: boolean;
  longBreak: boolean;
}

export interface WorkRules {
  requiredMinutes: number;
  maxBreakMinutes: number;
}

export interface Holiday {
  id: Id;
  date: ISODate;
  name: string;
}

export type LeaveType = "leave" | "cl" | "sl" | "ol" | "el" | "comp_off";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Leave {
  id: Id;
  employee_id: Id;
  from_date: ISODate;
  to_date: ISODate;
  reason: string | null;
  status: LeaveStatus;
  leave_type: LeaveType;
  created_at: ISODateTime;
  reviewed_at: ISODateTime | null;
  employee_name?: string;
  reviewed_by_name?: string | null;
}

export interface Balance {
  quota: number;
  used: number;
  available: number;
}

export interface Balances {
  financialYear: { start: ISODate; end: ISODate };
  cl: Balance;
  sl: Balance & { carriedForward: number };
  ol: Balance;
  el: Balance & { month: string };
  comp_off: Balance & { earnedDates: ISODate[]; validDays: number };
}

export interface TodayResponse {
  date: ISODate;
  isSunday: boolean;
  holiday: Holiday | null;
  day: AttendanceDay | null;
  rules: WorkRules;
}

export interface CalendarResponse {
  month: string;
  today: ISODate;
  employee: { id: Id; name: string };
  days: AttendanceDay[];
  holidays: Holiday[];
  leaves: Leave[];
  balances: Balances;
  rules: WorkRules;
}

export type DayFlag =
  | "online"
  | "offline"
  | "leave_off"
  | "missing"
  | "short"
  | "forced_short"
  | "long_break"
  | "forced_long_break";

export interface AttendanceDayResponse {
  date: ISODate;
  today: ISODate;
  employee: { id: Id; name: string; code: string | null };
  day: AttendanceDay | null;
  holiday: Holiday | null;
  leaves: Leave[];
  flags: DayFlag[];
  status: DayFlag | "none";
  locations: string[];
  rules: WorkRules;
}

export interface MonthLeave extends Leave {
  days: number;
  monthFrom: ISODate;
  monthTo: ISODate;
}

export interface MyLeavesResponse {
  month: string;
  employee: { id: Id; name: string };
  leaves: MonthLeave[];
}

export interface LeavePolicy {
  cl_per_year: number;
  sl_per_year: number;
  ol_per_year: number;
  el_per_month: number;
}

// ---- Tasks ----
export type TaskStatus = "todo" | "in_progress" | "done" | "approved";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: Id;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  assigned_to: Id;
  assigned_by: Id | null;
  assigned_date: ISODate;
  due_date: ISODate | null;
  completed_at: ISODateTime | null;
  approved_by: Id | null;
  approved_at: ISODateTime | null;
  updated_at: ISODateTime;
  assigned_to_name: string;
  assigned_by_name: string | null;
  approved_by_name: string | null;
  overdue: boolean;
}

export interface TaskStats {
  total: number;
  counts: Record<"approved" | "done" | "in_progress" | "todo" | "overdue", number>;
  weekly: { week: ISODate; completed: number }[];
  completionRate: number;
  onTimeRate: number;
  avgProgress: number;
}

export interface AssignableEmployee {
  id: Id;
  name: string;
  designation: string | null;
}

// ---- Announcements ----
export interface Announcement {
  id: Id;
  title: string;
  message: string | null;
  created_by: Id | null;
  created_by_name: string | null;
  created_at: ISODateTime;
  canDelete: boolean;
}

export interface Birthday {
  employeeId: Id;
  name: string;
  designation: string | null;
}

// ---- Payroll ----
export interface SalaryStructure {
  id: Id;
  employee_id: Id;
  basic: string;
  hra: string;
  allowances: string;
  effective_from: ISODate;
  employee_name?: string;
}

export interface PayrollRun {
  id: Id;
  month: number;
  year: number;
  status: string;
  run_at: ISODateTime;
}

export interface Payslip {
  id: Id;
  employee_id: Id;
  employee_name: string;
  designation: string | null;
  gross: string;
  pf_employee: string;
  esi_employee: string;
  professional_tax: string;
  tds: string;
  net_pay: string;
}

// ---- Recruitment ----
export type CandidateStage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface JobPosting {
  id: Id;
  title: string;
  department: string | null;
  location: string | null;
  description: string | null;
  status: "open" | "closed";
  candidate_count: number;
}

export interface Candidate {
  id: Id;
  job_posting_id: Id;
  job_title: string;
  name: string;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  stage: CandidateStage;
  notes: string | null;
}

// ---- Performance ----
export type ReviewStatus = "draft" | "submitted" | "acknowledged";

export interface ReviewCycle {
  id: Id;
  name: string;
  start_date: ISODate;
  end_date: ISODate;
  status: "active" | "closed";
  review_count: number;
}

export interface Review {
  id: Id;
  cycle_id: Id;
  employee_id: Id;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  goals_next_cycle: string | null;
  manager_comments: string | null;
  status: ReviewStatus;
  employee_name?: string;
}

// ---- Billing ----
export interface Subscription {
  status: "trial" | "active" | "past_due" | "cancelled";
  current_period_end: ISODateTime | null;
  trial_ends_at: ISODateTime | null;
}

export interface BillingStatus {
  subscription: Subscription;
  employeeCount: number;
  pricePerEmployee: number;
  monthlyAmount: number;
  trialDaysLeft: number;
  isTrialExpired: boolean;
}

export interface Invoice {
  id: Id;
  amount: string;
  employee_count: number;
  status: "paid" | "failed" | "pending";
  razorpay_invoice_id: string | null;
  created_at: ISODateTime;
}

export interface SubscribeResponse {
  razorpaySubscriptionId: string;
  razorpayKeyId: string;
  quantity: number;
  monthlyAmount: number;
}
