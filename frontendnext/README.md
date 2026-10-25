# Sangvya — Next.js frontend

The Sangvya HRMS web app, rebuilt on **Next.js 16 (App Router) + TypeScript**, with
**zustand** for state, **axios** for API calls, **Zod + react-hook-form** for forms,
and **shadcn/ui** components. The original Vite app in `../frontend` is untouched.

## Run it

```bash
cp .env.example .env.local   # then set JWT_SECRET to the backend's value
npm install
npm run dev                  # http://localhost:3000
```

| Variable | What it is |
| --- | --- |
| `BACKEND_URL` | Where the Express backend runs. `/api/*` is forwarded there (read at build time). |
| `JWT_SECRET` | **Same value as the backend's `JWT_SECRET`.** `proxy.ts` verifies the login token with it to guard pages by role. Server-only. |

On the backend, set `TRUST_PROXY=1` (requests now arrive through this app) and
`FRONTEND_URL` to this app's URL.

## How it fits together

```
Browser ──► Next.js ──► proxy.ts (who are you? may you open this page?)
                    └─► /api/* rewritten to BACKEND_URL (Express)
```

- **Same-origin API.** The browser only talks to this app; `next.config.ts` forwards
  `/api/*` to the backend, so the HttpOnly login cookies belong to this origin.
- **Route guard — `src/proxy.ts`.** Runs before every page. It verifies the access
  token, refreshes it with the refresh cookie when it has expired, and then:
  logged out → `/login?next=…`; logged in on `/login` → `/`; role not allowed →
  `/forbidden`. Which page needs which permission lives in one table,
  `ROUTE_PERMISSIONS` in `src/lib/permissions.ts` (the sidebar reads it too).
  The backend still checks every API call — this only decides what pages show.
- **Data.** `src/lib/services/*` are typed axios calls (one file per backend module);
  `src/stores/*` are zustand stores that call them and show success/error toasts.
- **Forms.** Every form has a Zod schema in `src/lib/schemas/*` that validates the
  inputs and turns them into the exact API payload.
- **Session.** The access token is refreshed while you're active; after 20 idle
  minutes you're logged out (with a warning 2 minutes before). Logging out in one
  tab logs out every tab.

## Appearance

The palette button in the header has three settings:

- **Mode** — Light (white), Dark (black and its shades) or System.
- **Accent** — Neutral, Blue, Green, Red, Orange, Violet or Rose. Buttons, links,
  focus rings and active states take the accent in both modes (e.g. dark + blue).
  Saved per browser.
- **Font size** — 10–17px (13 = normal). Saved to the user's account, so it follows
  them to any device. Only text scales; spacing stays put.

Colors are CSS variables in `src/app/globals.css`. To add an accent, add a
`:root[data-accent="…"]` and `.dark[data-accent="…"]` block there and an entry in
`ACCENTS` (`src/lib/appearance.ts`).

## Structure

```
src/
├── proxy.ts                 page guard (auth + role)
├── app/
│   ├── (auth)/              login, signup, forgot-password
│   └── (app)/               every logged-in page (sidebar + header layout)
├── components/
│   ├── ui/                  shadcn/ui components
│   ├── layout/              app shell, sidebar, header, appearance menu, page gate
│   ├── common/              page header, empty state, form field, status badge…
│   └── <module>/            one folder per feature (employees, payroll, …)
├── lib/
│   ├── api/                 axios client + run() toast helper
│   ├── services/            typed API calls per backend module
│   ├── schemas/             Zod form schemas
│   ├── permissions.ts       roles, permissions, page → permission table
│   └── types.ts             API response types
└── stores/                  zustand stores
```

### Adding a page

1. `src/lib/services/x.ts` + `src/stores/x-store.ts` (+ a schema in `src/lib/schemas/` for forms).
2. `src/components/x/x-view.tsx` — the page content (`"use client"`).
3. `src/app/(app)/x/page.tsx` — metadata + `<PageGate><XView /></PageGate>`.
4. If it needs a permission, add it to `ROUTE_PERMISSIONS` and the sidebar entry to
   `components/layout/nav-items.ts`.
