# ── shared deps ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── proxy service ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS proxy
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server/ ./server/
COPY tsconfig*.json ./
EXPOSE 3001
CMD ["node_modules/.bin/tsx", "server/proxy.ts"]

# ── vite build ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npm run build

# ── frontend (nginx) ──────────────────────────────────────────────────────────
FROM nginx:alpine AS frontend
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
