# Staging deploy — staging.workkind.in

| Part | Where | URL |
|---|---|---|
| Frontend (Next.js) | Vercel | https://staging.workkind.in |
| Backend (Express) | Render | https://stagingapi.workkind.in |
| Database | Neon branch `staging` (copy of production) | — |

The browser only talks to `staging.workkind.in`. Vercel forwards `/api/*` to the backend, so login cookies stay on one site.

## 1. Push the code

Render and Vercel deploy from GitHub branch `dev_ashish` (it must contain `render.yaml`).

## 2. Neon — staging branch

1. Neon console → your project → **Branches** → **Create branch**.
2. Name `staging`, parent = your production branch (copies today's data).
3. Copy the **pooled** connection string of `staging` (ends with `?sslmode=require`).

It's a copy: changes on staging never touch production.

## 3. A new JWT secret (staging only)

```bash
openssl rand -base64 48
```

Use the same value on Render and Vercel. Never reuse production's.

## 4. Render — backend

1. Render dashboard → **New** → **Blueprint** → connect `DevMishra-2001/Sangvya`.
2. It reads `render.yaml` and creates `workkind-staging-api` (Singapore, Starter plan).
3. Fill the secrets it asks for:
   - `DATABASE_URL` — Neon staging string (step 2)
   - `JWT_SECRET` — step 3
   - `MAIL_REDIRECT_TO` — your own inbox. **Required**: the data is a copy of production, so without it staging could email real employees.
   - SMTP / ImageKit — optional (empty SMTP = emails only print in the logs)
   - Razorpay — **test mode** keys only, or leave empty (billing stays off)
4. **Apply**. Each deploy runs the migrations, then starts the server.
5. Check: `https://<service>.onrender.com/health` → `{"status":"ok"}`

## 5. Vercel — frontend

1. Vercel → **Add New** → **Project** → import `DevMishra-2001/Sangvya`.
2. **Root Directory**: `frontendnext` (framework: Next.js).
3. Environment variables:
   - `BACKEND_URL` = `https://stagingapi.workkind.in`
   - `JWT_SECRET` = same as Render
4. **Deploy**.
5. Settings → **Git** → Production Branch = `dev_ashish`.
6. Settings → **Domains** → add `staging.workkind.in`.

`BACKEND_URL` is read at build time: after changing it, **Redeploy**.

## 6. DNS (where workkind.in is registered)

| Type | Name | Value |
|---|---|---|
| CNAME | `staging` | `cname.vercel-dns.com` (or what Vercel shows) |
| CNAME | `stagingapi` | `workkind-staging-api.onrender.com` (what Render shows) |

HTTPS certificates are issued automatically after DNS resolves (a few minutes).

## 7. Checks

- [ ] https://stagingapi.workkind.in/health → ok
- [ ] https://staging.workkind.in → login page, log in works
- [ ] Render **Logs**: request lines start with **your** public IP (Google "what is my ip").
      If it's a different address, change `TRUST_PROXY` (3 if it's a Vercel IP) — otherwise everyone shares one rate limit.
- [ ] Forgot password → the OTP mail arrives at `MAIL_REDIRECT_TO` with `[to …]` in the subject
- [ ] Reports → PDF / Excel download, Employees → Import, Custom Roles

## Notes

- Free Render plan sleeps after 15 min (slow first request, daily jobs skip) — Starter avoids that.
- `COOKIE_SAMESITE=lax` so links from emails open logged in. Production can use the same.
- Refresh staging data any time: Neon → `staging` branch → **Reset from parent**.
