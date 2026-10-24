# Sangvya SaaS — Starter Project

Multi-tenant HR Management System. One backend + database serves many companies (tenants); each company only ever sees its own data.

**Stack:** Node.js + Express + PostgreSQL (backend) · React + Redux Toolkit (frontend)

## What's included

**Backend** (`/backend`) — fully working REST API
- `signup` / `login` (JWT auth, one company + admin user created per signup)
- Employees — full CRUD
- Attendance — mark & view by date / by employee
- Leave requests — apply, approve, reject
- Middleware: JWT auth, role checks, tenant isolation, request validation, rate limiting, centralized error handling, security headers, request logging

**Frontend** (`/frontend`) — React + Redux Toolkit + Tailwind CSS
- Styling entirely in Tailwind utility classes (`tailwind.config.js` has a custom "ledger" color palette — `ink`, `ivory`, `brass`, `leaf`, `rust`, `gold` — matching the product's visual identity)
- Redux slice per feature (`auth`, `employees`, `attendance`, `leave`, `payroll`) — each with async thunks calling the API
- One component per concern (forms, lists, tables) under `src/components/`
- Pages compose components + connect to Redux under `src/pages/`
- Protected routing (redirects to `/login` if not authenticated)

- **Payroll** — salary structure per employee, run monthly payroll (auto-pulls attendance/approved leave to prorate pay), PF/ESI/Professional Tax/TDS calculated per Indian statutory rules (simplified — see note below), downloadable PDF payslips
- **Recruitment** — job postings (open/closed), candidate pipeline with stages (Applied → Screening → Interview → Offer → Hired → Rejected), one-click "Add to Employees" when a candidate is marked Hired
- **Performance Review** — review cycles (e.g. "Q3 2026"), per-employee reviews with 1-5 star rating, strengths/improvements/goals/manager comments, draft → submitted → acknowledged workflow

- **Billing** — every new company starts on a 14-day free trial; ₹15/employee/month via Razorpay Subscriptions, quantity auto-syncs whenever employees are added/removed, downloadable billing history

All five core HR modules — Employees, Attendance & Leave, Payroll, Recruitment, Performance Review — plus Billing are now built. Next is production hardening (see below) rather than another feature module.

## Billing — how it works

Pricing is ₹15 per employee per month, via [Razorpay Subscriptions](https://razorpay.com/docs/payments/subscriptions/).

**One-time setup (per environment):**
1. Get API keys from the [Razorpay dashboard](https://dashboard.razorpay.com/app/keys) and put them in `backend/.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
2. Run `npm run setup-billing` inside `/backend` — this creates the one Razorpay Plan this whole product bills against (₹15/unit/month) and prints a Plan ID
3. Put that Plan ID in `backend/.env` as `RAZORPAY_PLAN_ID`
4. In the Razorpay dashboard, create a webhook pointing to `https://<your-backend-domain>/api/billing/webhook`, subscribed to at least: `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`. Copy its signing secret into `backend/.env` as `RAZORPAY_WEBHOOK_SECRET`

**How a company gets billed:**
1. On signup, a `subscriptions` row is created with `status = 'trial'` and a 14-day `trial_ends_at` (no card required)
2. Every time an employee is added, removed, or a hired candidate is converted, `syncSubscriptionQuantity` updates the subscription's `quantity` to match the current headcount
3. From the Billing page, the admin clicks "Subscribe now" — this creates a Razorpay Customer + Subscription (quantity = current headcount) and opens Razorpay's Checkout widget to authorize the card/UPI mandate
4. Razorpay charges `quantity × ₹15` every month automatically. If headcount changes between renewals, the new quantity applies from the **next** billing cycle (Razorpay doesn't retroactively adjust a cycle already in progress)
5. All state changes (activated, charged, payment failed, cancelled) arrive via the `/api/billing/webhook` endpoint — **the webhook, not the browser, is the source of truth** for whether a payment actually succeeded

**Note:** the current build calculates and displays trial/subscription status but does not yet *block* access when a trial expires or a payment fails — it flags `past_due` so the UI can prompt the admin, but every module stays usable. Wiring a hard paywall (e.g. a `requireActiveSubscription` middleware on the feature routes) is a deliberate next step once you've decided how strict you want that gate to be — see Section "Extending with a new module" for the same five-file pattern this would follow on the backend, plus a middleware.

### A note on the Payroll module's statutory calculations

`backend/src/utils/payrollCalculations.js` implements PF (12%/12%, ₹15,000 wage ceiling), ESI (0.75%/3.25%, ₹21,000 threshold), Professional Tax (generic slab), and TDS (new-regime income tax slabs, simplified — no investment declarations or old-regime support). These are reasonable estimates for a starter product, but **have a CA or payroll consultant review them before running real employee payroll** — PT varies by state, and TDS in a real system needs to account for each employee's declared investments and regime choice.

## Running it locally

### 1. Database

You need a PostgreSQL server (local install, Docker, or a hosted service like Supabase/Neon/Railway — all have free tiers).

```bash
createdb hrms_db
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string,
# and JWT_SECRET to a long random string
npm install
npm run migrate     # creates all tables
npm run dev          # starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL should point at your backend, e.g. http://localhost:5000/api
npm install
npm run dev          # starts on http://localhost:3000
```

Open `http://localhost:3000`, click **Sign up**, and you'll have a company + admin account.

## Multi-tenancy — how data isolation works

1. On signup, a `companies` row is created and the user is tied to it via `company_id`.
2. Login returns a JWT containing `companyId`.
3. Every protected request runs through `authenticate` (verifies JWT) → `scopeToCompany` (reads `companyId` from the verified token, never from the request body).
4. Every database query in `models/` filters `WHERE company_id = $1` using that trusted id.

This means one company can never read or modify another company's data, even if they tamper with request bodies — the isolation is enforced server-side, not trusted from the client.

## Before selling this to real customers

This is a solid foundation, but production-readiness needs a few more things:

- **Payments/subscriptions** — Stripe or Razorpay integration, plan limits
- **Email** — verification, password reset (e.g. via Resend/SendGrid)
- **Hosting** — backend on Render/Railway/Fly.io, frontend on Vercel/Netlify, database on a managed Postgres provider
- **Testing** — at least integration tests for auth and tenant isolation
- **Refresh tokens** — current setup uses a single long-lived JWT; refresh tokens are more secure for a real product
- **Audit logging** — who changed what, useful for HR compliance

## Extending with a new module

Follow the same five-file pattern used throughout this codebase:
1. `backend/src/models/xModel.js` — queries, always scoped by `companyId`
2. `backend/src/controllers/xController.js` — request handling
3. `backend/src/routes/xRoutes.js` — wire up `authenticate`, `scopeToCompany`, validation
4. `frontend/src/store/slices/xSlice.js` — thunks + reducer
5. `frontend/src/components/x/` + `frontend/src/pages/XPage.jsx` — UI
