# Backend on AWS EC2 with Docker Compose

The API runs in one container. The database stays on Neon, and the frontend stays on Vercel.

| Part | Where |
|---|---|
| Backend (this folder) | EC2 + Docker Compose → `https://api.workkind.in` |
| Database | Neon (production branch) |
| Frontend | Vercel → `https://workkind.in`, with `BACKEND_URL=https://api.workkind.in` |

Each start runs the database migrations first (`node dist/migrate.js`), then the server. A failed migration stops the start and prints the reason.

## 1. EC2

- **Instance:** Ubuntu 24.04, `t3.small` (2 GB) or bigger, region `ap-south-1` (Mumbai).
- **Security group:** open 22 (SSH, your IP only), 80 and 443. Don't open 5000.
- **Elastic IP:** attach one, so the address doesn't change on restart.

Install Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu   # log out and back in after this
```

## 2. Get the code and settings

```bash
git clone https://github.com/DevMishra-2001/Sangvya.git
cd Sangvya/backend
cp .env.example .env
nano .env
```

Production values in `.env`:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon production **pooled** string (`…?sslmode=require`) |
| `JWT_SECRET` | new long random value (`openssl rand -base64 48`). Use the same value on Vercel. |
| `FRONTEND_URL` | `https://workkind.in` |
| `TRUST_PROXY` | `2` (Vercel → Nginx → app). Check that the logs show real visitor IPs. |
| `COOKIE_SAMESITE` | `lax` |
| `SMTP_*`, `MAIL_FROM` | your mail provider |
| `IMAGEKIT_*` | your ImageKit keys, with `IMAGEKIT_FOLDER=/sangvya` |
| `RAZORPAY_*` | live keys + webhook secret (or leave empty until billing goes live) |
| `MAIL_REDIRECT_TO` | **empty** in production |

Never commit `.env`.

## 3. Start

```bash
docker compose up -d --build
docker compose ps                 # STATUS should say (healthy)
docker compose logs -f backend    # "Migrations: up to date" … "running on port 5000"
curl http://127.0.0.1:5000/health # {"status":"ok"}
```

## 4. HTTPS with Nginx (port 5000 only listens on the server itself)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/api <<'NGINX'
server {
  server_name api.workkind.in;
  client_max_body_size 10m;          # uploads (photos, documents, imports)
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX
sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.workkind.in    # free HTTPS, renews by itself
```

DNS: add an **A record** `api` pointing to the Elastic IP before running certbot.

## 5. Updating

```bash
cd Sangvya && git pull
cd backend && docker compose up -d --build   # migrations run on start
docker image prune -f                        # remove old images
```

### Option: build once and push to Amazon ECR

Use this instead of building on the server. Build for the server's CPU: `linux/amd64` for t3, or `linux/arm64` for t4g/Graviton.

```bash
aws ecr create-repository --repository-name workkind-backend --region ap-south-1   # once
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.ap-south-1.amazonaws.com
docker buildx build --platform linux/amd64 -t <account>.dkr.ecr.ap-south-1.amazonaws.com/workkind-backend:latest --push .
# on EC2 (needs an IAM role with ECR read access):
BACKEND_IMAGE=<account>.dkr.ecr.ap-south-1.amazonaws.com/workkind-backend:latest docker compose pull
BACKEND_IMAGE=<account>.dkr.ecr.ap-south-1.amazonaws.com/workkind-backend:latest docker compose up -d
```

## Notes

- **First Super Admin:** run it once from your laptop against the production database. The image doesn't include the scripts.
  ```bash
  DATABASE_URL="<neon production url>" npm run create-superadmin -- you@workkind.in '<password>' "Your Name"
  ```
- **One copy at a time** runs migrations safely. If you run several copies, set `RUN_MIGRATIONS=false` on all but one.
- **Logs** are capped at 5 × 10 MB, so the disk doesn't fill up.
- **Razorpay webhook URL:** `https://api.workkind.in/api/billing/webhook`
