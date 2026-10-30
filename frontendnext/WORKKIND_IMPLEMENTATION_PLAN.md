# WORKKIND HRMS — IMPLEMENTATION PLAN & SPRINT CHECKLIST
> Multi-Tenant SaaS Architecture for Superadmin, Company Admin & Employee Portals.
> Target: Workkind Platform

---

## 📌 Guiding Principles & Decisions
1. **Zero Manual Passwords**:
   - Superadmin invites Admin via work email.
   - Admin receives secure 24-48hr activation link (`/activate?token=...`).
   - Admin sets their own password and activates the account. Same flow for Employee onboarding.
2. **Flexible Onboarding with Profile Completion %**:
   - Basic Company profile & workplace defaults are required to start.
   - Legal/Tax details (PAN, GSTIN, CIN) can be filled during onboarding OR finished later from the dashboard.
   - Company Admin Dashboard displays **"Profile Completion: X%"** banner with quick links to complete missing steps.
3. **Roles vs. Designations**:
   - *Designation*: Title on ID card/profile (e.g., Software Engineer, HR Lead).
   - *Role*: System permissions (`superadmin`, `company_admin`, `hr_manager`, `employee`).
4. **Step-by-Step Execution**:
   - Build 1 feature at a time, test end-to-end, then proceed to next.

---

## 🚀 MILESTONE 1: Superadmin Invites Admin & Password Setup Flow (CURRENT SPRINT)

- [ ] **Step 1.1: Database Schema (`backend/src/db/schemas/user.schema.ts` or `invitation.schema.ts`)**
  - Create `user_invitations` table:
    - `id`: serial
    - `email`: varchar(150), indexed
    - `name`: varchar(150)
    - `role`: varchar(30), default 'company_admin'
    - `company_name_draft`: varchar(200)
    - `token_hash`: text, not null
    - `expires_at`: timestamptz, not null
    - `accepted_at`: timestamptz
    - `invited_by`: integer (fk to users.id)
    - `created_at`: timestamptz

- [ ] **Step 1.2: Backend Invitation API Endpoints**
  - `POST /api/superadmin/admins/invite`:
    - Validates email and name.
    - Generates 32-byte crypto token, stores SHA-256 hash.
    - Sends email with link: `${APP_URL}/activate?token=${token}` (and logs link in console for local dev).
  - `GET /api/auth/invite/verify?token=...`:
    - Checks token validity, expiry, and returns `{ valid: true, email, name, companyNameDraft }`.
  - `POST /api/auth/invite/accept`:
    - Validates strong password.
    - Creates user (or activates pending user) with `role = 'company_admin'`.
    - Marks invitation `accepted_at = NOW()`.
    - Issues auth session cookies and returns `{ success: true, redirect: '/onboarding' }`.

- [ ] **Step 1.3: Frontend Activation Page (`frontendnext/src/app/(auth)/activate/page.tsx`)**
  - Matches Workkind sleek branding.
  - Verifies token on mount; shows clear error if expired or invalid with "Request New Link" option.
  - New Password + Confirm Password with live `PasswordChecklist`.
  - On submit: logs user in and redirects smoothly to `/onboarding`.

- [ ] **Step 1.4: Superadmin Panel "Invite Company Admin" UI**
  - Modal with Name, Email, and Company Name.
  - Displays list of sent invitations with status (`Pending`, `Accepted`, `Expired`).
  - Action buttons: "Resend Invite", "Copy Link".

- [ ] **Step 1.5: End-to-End Verification of Milestone 1**
  - Verify complete loop: Superadmin invites -> Link generated -> User activates -> Auto-login.

---

## 🏢 MILESTONE 2: Company Setup Wizard (`/onboarding`)

- [ ] **Step 2.1: 4-Step Onboarding Form Structure**
  - **Step 1: Basic Company Details**:
    - Company / Brand Name *(Required)*
    - Legal Business Name *(Optional)*
    - Industry *(Required)*
    - Business Type *(Required)*: Pvt Ltd, LLP, Partnership, Sole Proprietorship, Public Ltd, Other
    - Employee Count Range *(Required)*: 1-10, 11-50, 51-200, 201-500, 500+
    - Company Website *(Optional)*
    - Company Logo *(Optional)*
    - Year Established *(Optional)*
  - **Step 2: Contact & Address**:
    - Official Email *(Required)*
    - Contact Phone *(Required)*
    - Country, State, City *(Required)*
    - Registered Address *(Required)*
    - Postal Code *(Required)*
    - Office Locations *(Optional)*
    - Timezone *(Required, default Asia/Kolkata)*
  - **Step 3: Legal & Tax Details (Skippable / Finish Later)**:
    - Company PAN *(Conditional with format validation)*
    - GSTIN *(Optional with checksum validation against PAN)*
    - CIN / LLPIN *(Optional)*
    - TAN *(Optional)*
    - Billing Address *(Optional during setup, defaults to registered)*
  - **Step 4: Workplace Defaults**:
    - Default Work Week *(Mon-Fri / Mon-Sat)*
    - Office Start & End Time *(e.g., 09:30 AM - 06:30 PM)*
    - Attendance Mode *(Web Punch, Mobile, Biometric)*
    - Leave Year *(Jan-Dec / Apr-Mar)*
    - Default Currency *(INR ₹ / USD $)*
    - Employee ID Prefix *(e.g., WK-)*

- [ ] **Step 2.2: Profile Completion Calculation Algorithm**
  - Calculate % score (e.g. Basic 40% + Contact 30% + Legal 20% + Workplace 10%).
  - Store score in `companies.profile_completion_percentage`.

---

## 📊 MILESTONE 3: Company Admin Dashboard & Completion Banner

- [ ] **Step 3.1: Dashboard Setup Progress Widget**
  - If `profile_completion_percentage < 100%`, show prominent yet non-blocking banner:
    - *"Your profile is 65% complete. Add your Company PAN & GSTIN to unlock automated invoicing and statutory compliance."*
    - One-click modal to complete remaining fields anytime.
- [ ] **Step 3.2: Core HR Dashboard Metrics**
  - Headcount overview (Total, Active, On Leave today).
  - Quick actions: "Add Employee", "Invite Team Member", "Set Holiday Calendar".

---

## 🔒 MILESTONE 4: Company-Wise Module Provisioning (Feature Flags)
- [ ] `company_modules` table mapping enabled modules per tenant.
- [ ] Superadmin toggle switches to activate/deactivate modules per company.
- [ ] Frontend sidebar dynamically filtering navigation items.
- [ ] Backend route guards (`requireModule('payroll')`).

---

## 👥 MILESTONE 5: Employee Invitation Flow
- [ ] Company Admin invites employees using the same token invitation infrastructure.
- [ ] Employee self-service activation & password setup.
