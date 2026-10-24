// Run with: npm run migrate
// Creates all tables needed for the multi-tenant Sangvya platform.
// Every business table carries a company_id — this is how one database
// serves many companies (tenants) while keeping their data isolated.
const { pool } = require("./db");

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'employee', -- superadmin | hr | manager | employee (see config/permissions.js)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  designation VARCHAR(100),
  department VARCHAR(100),
  email VARCHAR(150),
  join_date DATE,
  salary NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- present | absent | half
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Roles ----------
-- A user login can be linked to its employee record, so "my leave",
-- "my payslip" etc. know which employee the logged-in user is.
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id) WHERE employee_id IS NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';
-- Older databases used 'admin' for the company owner — that's now 'superadmin'.
UPDATE users SET role = 'superadmin' WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance(company_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_company_status ON leave_requests(company_id, status);

-- ---------- Payroll ----------

-- One active structure per employee at a time; a new effective_from row
-- represents a revision/increment without losing history.
CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic NUMERIC(12,2) NOT NULL,
  hra NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One row per company per month/year — represents "payroll for Sept 2026 was run".
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed', -- completed | reversed
  run_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, month, year)
);

-- One row per employee per payroll run — the actual computed payslip.
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic NUMERIC(12,2) NOT NULL,
  hra NUMERIC(12,2) NOT NULL,
  allowances NUMERIC(12,2) NOT NULL,
  gross NUMERIC(12,2) NOT NULL,
  paid_days NUMERIC(5,2) NOT NULL,
  total_days INTEGER NOT NULL,
  pf_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
  esi_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  esi_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
  professional_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL,
  net_pay NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_structures_employee ON salary_structures(employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_payslips_company_run ON payslips(company_id, payroll_run_id);

-- ---------- Recruitment ----------

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  department VARCHAR(100),
  location VARCHAR(100),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open | closed
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  resume_url TEXT,
  -- Pipeline stage. Order matters for the board view in the UI.
  stage VARCHAR(20) NOT NULL DEFAULT 'applied', -- applied | screening | interview | offer | hired | rejected
  notes TEXT,
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_company_job ON candidates(company_id, job_posting_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(company_id, stage);

-- ---------- Performance Review ----------

-- A review cycle groups reviews together, e.g. "Q3 2026" or "Annual 2026".
CREATE TABLE IF NOT EXISTS review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | closed
  created_at TIMESTAMPTZ DEFAULT now()
);

-- One review per employee per cycle.
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  strengths TEXT,
  improvements TEXT,
  goals_next_cycle TEXT,
  manager_comments TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | submitted | acknowledged
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_review_cycles_company ON review_cycles(company_id, status);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_company_cycle ON performance_reviews(company_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_employee ON performance_reviews(employee_id);

-- ---------- Billing / Subscription ----------

-- One subscription per company. Billed as: employee_count x price_per_employee.
-- Razorpay's "quantity" on the subscription is kept in sync with the quantity
-- column below, so the next auto-charge always reflects the current employee count.
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  razorpay_customer_id VARCHAR(100),
  razorpay_subscription_id VARCHAR(100),
  razorpay_plan_id VARCHAR(100),
  price_per_employee NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  quantity INTEGER NOT NULL DEFAULT 0,          -- employee count Razorpay is currently billing for
  status VARCHAR(20) NOT NULL DEFAULT 'trial',  -- trial | active | past_due | cancelled
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- A record of every charge, successful or failed — feeds the "Billing history" screen.
-- Populated from Razorpay webhook events, which is the source of truth for payment status.
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  razorpay_payment_id VARCHAR(100),
  razorpay_invoice_id VARCHAR(100),
  amount NUMERIC(12,2) NOT NULL,
  employee_count INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL, -- paid | failed | pending
  billing_month INTEGER,
  billing_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Raw webhook events from Razorpay, kept for idempotency (Razorpay can
-- redeliver the same event) and for debugging when billing state looks wrong.
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_event_id VARCHAR(150) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub ON subscriptions(razorpay_subscription_id);

-- ---------- Self-service attendance (punch in/out, breaks) ----------

-- Who an employee reports to — their manager gets emailed about short days / long breaks.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- A day's attendance row now also carries the punch times. Rows marked by
-- HR from the Attendance page simply have these left NULL.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out TIMESTAMPTZ;

-- Any number of breaks per day; break_end is NULL while the break is running.
CREATE TABLE IF NOT EXISTS attendance_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_attendance ON attendance_breaks(attendance_id);

-- Company holidays, set by HR/superadmin — shown on every employee's calendar.
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, date)
);

-- leave | cl (casual) | sl (sick) | comp_off (worked on a Sunday/holiday)
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(20) NOT NULL DEFAULT 'leave';

-- ---------- Tasks ----------

-- Assigned by a manager/HR/superadmin to an employee. Flow:
-- todo -> in_progress -> done (by the assignee) -> approved (by the assigner/HR),
-- or reopened back to in_progress.
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium', -- low | medium | high
  status VARCHAR(20) NOT NULL DEFAULT 'todo',     -- todo | in_progress | done | approved
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  assigned_to UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(company_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigner ON tasks(company_id, assigned_by);

-- ---------- Announcements & birthdays ----------

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_company ON announcements(company_id, created_at DESC);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- ---------- Per-user settings ----------
-- Each user's own UI font size (10–17px, 13 = normal). Stored per account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS font_size SMALLINT NOT NULL DEFAULT 13
  CHECK (font_size BETWEEN 10 AND 17);

-- ---------- Attendance details + leave balances ----------
-- Where the employee checked in/out from, with an optional remark.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_location VARCHAR(40);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_remarks TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_location VARCHAR(40);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_remarks TEXT;

-- Who approved/rejected a leave and when.
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Company leave quotas. The leave year is the financial year (April–March).
--   CL: per year, lapses at year end
--   SL: per year, unused days carry forward to the next year
--   OL: per year, default for employees without their own number (employees.ol_quota)
--   EL: per month, unused days are paid out (encashed) at month end
CREATE TABLE IF NOT EXISTS leave_policies (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  cl_per_year NUMERIC(5,1) NOT NULL DEFAULT 6,
  sl_per_year NUMERIC(5,1) NOT NULL DEFAULT 6,
  ol_per_year NUMERIC(5,1) NOT NULL DEFAULT 2,
  el_per_month NUMERIC(5,1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ol_quota NUMERIC(5,1); -- NULL = company default

-- ---------- Login sessions (refresh tokens) ----------
-- One row per login. The short-lived access JWT carries the session id; the
-- refresh token (only its hash is stored) is rotated on every refresh.
-- last_activity_at moves only when the user is actually active, so an idle
-- session can't be refreshed after SESSION_IDLE_MIN.
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  previous_token_hash TEXT,          -- the token just replaced (grace window for parallel tabs)
  rotated_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,   -- absolute limit, however active the user is
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_prev ON user_sessions(previous_token_hash);

-- ---------- Forgot password (OTP) ----------
-- One active request per user. Only hashes are stored — never the OTP or token.
-- Flow: OTP emailed → verified (attempts capped) → short-lived reset token → new password.
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  reset_token_hash TEXT,
  reset_expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token_hash);

-- An earlier build kept settings in a JSON "preferences" column — carry the
-- font size over, then drop that column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferences') THEN
    UPDATE users SET font_size = (preferences->>'fontSize')::smallint
    WHERE preferences ? 'fontSize' AND (preferences->>'fontSize')::int BETWEEN 10 AND 17;
    ALTER TABLE users DROP COLUMN preferences;
  END IF;
END $$;

-- ---------- Multiple punches per day ----------
-- Punch out = break starts; punching in again the same day turns that gap into a
-- break. The day is only final once it's over, so the manager alert (short day /
-- long break) runs after midnight; day_closed_at marks a day as checked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'day_closed_at') THEN
    ALTER TABLE attendance ADD COLUMN day_closed_at TIMESTAMPTZ;
    -- Days before this change were already alerted at punch-out
    UPDATE attendance SET day_closed_at = now() WHERE date < CURRENT_DATE;
  END IF;
END $$;

-- Every punch (in / out) with its own location + remarks — an employee picks
-- them again each time they come back from a break.
CREATE TABLE IF NOT EXISTS attendance_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  kind VARCHAR(3) NOT NULL CHECK (kind IN ('in', 'out')),
  punched_at TIMESTAMPTZ NOT NULL,
  location VARCHAR(40),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_punches ON attendance_punches(attendance_id, punched_at);

-- Company-assigned employee code (e.g. IISPL25888), unique within a company
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code ON employees(company_id, lower(employee_code)) WHERE employee_code IS NOT NULL;

-- Backfill days recorded before the punch log existed (first in / last out only)
INSERT INTO attendance_punches (company_id, attendance_id, kind, punched_at, location, remarks)
SELECT a.company_id, a.id, 'in', a.punch_in, a.punch_in_location, a.punch_in_remarks
FROM attendance a
WHERE a.punch_in IS NOT NULL AND NOT EXISTS (SELECT 1 FROM attendance_punches p WHERE p.attendance_id = a.id);
INSERT INTO attendance_punches (company_id, attendance_id, kind, punched_at, location, remarks)
SELECT a.company_id, a.id, 'out', a.punch_out, a.punch_out_location, a.punch_out_remarks
FROM attendance a
WHERE a.punch_out IS NOT NULL AND NOT EXISTS (SELECT 1 FROM attendance_punches p WHERE p.attendance_id = a.id AND p.kind = 'out');
`;

async function migrate() {
  try {
    await pool.query(SCHEMA);
    console.log("Migration complete — all tables created.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
