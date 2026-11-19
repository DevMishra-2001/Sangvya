# Workkind backend — production image
# Build:  docker build -t workkind-backend .
# Run:    docker compose up -d   (see docker-compose.yml)

# ---- 1. Build: install everything, compile TypeScript, then drop dev packages ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- 2. Run: only the compiled app, production packages and migrations ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./

# Never run as root inside the container
USER node
EXPOSE 5000

# Docker marks the container unhealthy if /health stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply migrations, then start (set RUN_MIGRATIONS=false to skip, e.g. when running several copies)
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then node dist/migrate.js || exit 1; fi; exec node dist/server.js"]
