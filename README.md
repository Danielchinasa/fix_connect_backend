<div align="center">

# FixConnect Backend API

A production-ready RESTful API for the **FixConnect** marketplace — connecting customers with skilled artisans for home repairs, maintenance, and professional services.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-UNLICENSED-red)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
  - [Pre-deployment Checklist](#pre-deployment-checklist)
  - [PM2 / VPS](#pm2--vps)
  - [Railway / Render / Fly.io](#railway--render--flyio)
  - [Docker](#docker)
- [Contributing](#contributing)
- [Changelog](#changelog)

---

## Overview

FixConnect is a two-sided marketplace. This backend exposes a versioned REST API (`/api/v1`) consumed by the FixConnect Flutter mobile application. Core capabilities include:

- **User authentication** with JWT access/refresh tokens, OTP email verification, and password reset
- **Artisan marketplace** with profiles, service categories, and availability
- **Booking lifecycle** management (pending → confirmed → in-progress → completed)
- **Escrow payment processing** via Paystack and Stripe with webhook-driven state transitions
- **In-app and push notifications** via Firebase Cloud Messaging
- **File uploads** for avatars and artisan work samples

---

## Architecture

```
┌─────────────────────┐        HTTPS        ┌──────────────────────────┐
│  Flutter Mobile App │ ◄──────────────────► │  NestJS REST API         │
└─────────────────────┘                      │  /api/v1                 │
                                             │                          │
┌─────────────────────┐                      │  ┌────────────────────┐  │
│  Paystack / Stripe  │ ──── Webhooks ──────►│  │  Payments Module   │  │
└─────────────────────┘                      │  └────────────────────┘  │
                                             │                          │
┌─────────────────────┐                      │  ┌────────────────────┐  │
│  Firebase FCM       │ ◄── Push Notifs ─────│  │  Notifications     │  │
└─────────────────────┘                      │  └────────────────────┘  │
                                             │                          │
                                             │  ┌────────────────────┐  │
                                             │  │  Prisma ORM        │  │
                                             └──┴────────┬───────────┘  │
                                                          │              │
                                             ┌────────────▼───────────┐  │
                                             │  PostgreSQL Database    │  │
                                             └────────────────────────┘  │
```

---

## Tech Stack

| Concern            | Technology                          | Version |
|--------------------|-------------------------------------|---------|
| Framework          | NestJS                              | 11      |
| Language           | TypeScript                          | 5       |
| ORM                | Prisma                              | 7       |
| Database           | PostgreSQL                          | 14+     |
| Authentication     | JWT (RS256 / HS256) + bcrypt        | —       |
| Input Validation   | class-validator / class-transformer | —       |
| File Uploads       | Multer                              | —       |
| Payments           | Paystack (NGN) + Stripe             | —       |
| Push Notifications | Firebase Admin SDK (FCM)            | —       |
| Testing            | Jest + Supertest                    | 30      |

---

## Project Structure

```
fix_connect_backend/
├── src/
│   ├── main.ts                     # App bootstrap — port, global prefix, pipes
│   ├── app.module.ts               # Root module
│   ├── auth/                       # Signup, login, JWT, OTP, password reset
│   ├── users/                      # User profiles (RBAC: CUSTOMER / ARTISAN / ADMIN)
│   ├── artisans/                   # Artisan profiles & availability
│   ├── bookings/                   # Booking lifecycle state machine
│   ├── payments/                   # Escrow payment initiation & webhooks
│   │   └── gateways/               # Paystack & Stripe adapter implementations
│   ├── bank-accounts/              # Artisan payout bank account management
│   ├── notifications/              # In-app & FCM push notifications
│   ├── reviews/                    # Customer reviews for artisans
│   ├── saved-addresses/            # Customer saved delivery/service locations
│   ├── service-categories/         # Service taxonomy (admin-managed)
│   ├── email/                      # Transactional email (OTP, receipts)
│   └── prisma/                     # Singleton PrismaClient module
│
├── prisma/
│   ├── schema.prisma               # Canonical database schema
│   └── migrations/                 # Timestamped migration history
│
├── prisma.config.ts                # Prisma 7 datasource config (reads DATABASE_URL)
├── uploads/                        # Runtime file storage (replace with S3 in prod)
│   ├── avatars/
│   └── work-samples/
│
├── test/                           # E2E test suite
├── .env.example                    # Template — copy to .env and fill values
└── FixConnect.postman_collection.json  # Importable Postman collection
```

---

## Prerequisites

| Requirement  | Minimum Version | Notes                                         |
|--------------|-----------------|-----------------------------------------------|
| Node.js      | 18 LTS          | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| npm          | 9               | Bundled with Node 18                          |
| PostgreSQL   | 14              | Local install or managed service (Supabase, Neon, RDS) |
| NestJS CLI   | 11 *(optional)* | `npm i -g @nestjs/cli` — for code generation only |

---

## Getting Started

### Environment Variables

> **Never commit `.env` to version control.** The file is already in `.gitignore`.

```bash
cp .env.example .env
```

Open `.env` and fill in every value. The table below describes each variable:

| Variable                 | Required | Description                                               |
|--------------------------|:--------:|-----------------------------------------------------------|
| `NODE_ENV`               | Yes      | `development`, `test`, or `production`                    |
| `PORT`                   | Yes      | HTTP port (default `3000`)                                |
| `DATABASE_URL`           | Yes      | Full PostgreSQL connection string (see format below)      |
| `JWT_ACCESS_SECRET`      | Yes      | Min 32-char random secret for signing access tokens       |
| `JWT_ACCESS_EXPIRES_IN`  | Yes      | Lifetime of access tokens (e.g. `15m`)                    |
| `JWT_REFRESH_SECRET`     | Yes      | Min 32-char random secret for signing refresh tokens      |
| `JWT_REFRESH_EXPIRES_IN` | Yes      | Lifetime of refresh tokens (e.g. `7d`)                    |
| `OTP_EXPIRY_MINUTES`     | Yes      | How long an OTP code remains valid (e.g. `10`)            |
| `PAYSTACK_SECRET_KEY`    | Yes      | From [Paystack dashboard](https://dashboard.paystack.com) |
| `PAYSTACK_PUBLIC_KEY`    | Yes      | From Paystack dashboard                                   |
| `FIREBASE_PROJECT_ID`    | Yes      | Firebase project identifier for FCM                      |
| `FIREBASE_PRIVATE_KEY`   | Yes      | Service account private key (multiline — use quotes)      |
| `FIREBASE_CLIENT_EMAIL`  | Yes      | Service account client email                              |

**DATABASE_URL format:**
```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
```

**Generate cryptographically strong secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run this command twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.

> **Production secret management:** Do not store secrets in plain `.env` files on production servers. Use a dedicated secrets manager: [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/), [HashiCorp Vault](https://www.vaultproject.io/), [Doppler](https://www.doppler.com/), or your platform's native secret store (Railway, Render, Fly.io all provide one).

---

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Danielchinasa/fix_connect_backend.git
cd fix_connect_backend

# 2. Install dependencies
npm ci          # use 'ci' (not 'install') for reproducible installs
```

---

### Database Setup

```bash
# Apply all pending migrations (safe for both dev and CI)
npx prisma migrate deploy --config prisma.config.ts

# OR, in development only — creates a new migration from schema changes
npx prisma migrate dev --config prisma.config.ts

# Regenerate the type-safe Prisma client (auto-runs after migrate)
npx prisma generate --config prisma.config.ts

# Inspect your database in a browser UI (development only)
npx prisma studio --config prisma.config.ts
```

> **Important:** Always use `prisma migrate deploy` (not `migrate dev`) in production CI/CD pipelines. `migrate dev` is interactive and may prompt or shadow-drop tables.

---

### Running the Application

```bash
# Development — TypeScript hot-reload
npm run start:dev

# Debug mode (attach a debugger on port 9229)
npm run start:debug

# Production — run compiled output
npm run build
npm run start:prod
```

| URL                                | Description                                      |
|------------------------------------|--------------------------------------------------|
| `http://localhost:3000/api/v1`     | API base URL (all versioned routes)              |
| `http://localhost:3000/uploads/`   | Static file assets (avatars, work samples)       |

**Postman Collection:** Import `FixConnect.postman_collection.json` from the root of this repository. After running `POST /auth/login`, the `accessToken` and `refreshToken` are automatically stored as collection variables and injected into all subsequent requests.

---

## API Reference

All routes are prefixed with `/api/v1`.  
Protected routes require the header: `Authorization: Bearer <access_token>`

### Auth — `/auth`

| Method | Endpoint                 | Auth     | Description                                      |
|--------|--------------------------|:--------:|--------------------------------------------------|
| POST   | `/auth/signup`           | Public   | Register — returns `accessToken` + `refreshToken` |
| POST   | `/auth/login`            | Public   | Login — returns `accessToken` + `refreshToken`   |
| POST   | `/auth/refresh`          | Public   | Exchange refresh token for a new access token    |
| POST   | `/auth/logout`           | Public   | Revoke a refresh token                           |
| GET    | `/auth/me`               | Required | Get authenticated user's profile                 |
| POST   | `/auth/otp/send`         | Public   | Send OTP (email verification or password reset)  |
| POST   | `/auth/otp/verify-email` | Public   | Confirm email ownership with OTP                 |
| POST   | `/auth/forgot-password`  | Public   | Trigger password-reset OTP                       |
| POST   | `/auth/reset-password`   | Public   | Set new password using valid OTP                 |

### Users — `/users`

| Method | Endpoint     | Auth       | Description         |
|--------|--------------|:----------:|---------------------|
| GET    | `/users`     | ADMIN      | List all users      |
| GET    | `/users/:id` | Required   | Get user by ID      |
| PATCH  | `/users/:id` | Required   | Update user profile |

### Artisans — `/artisans`

| Method | Endpoint            | Auth     | Description                  |
|--------|---------------------|:--------:|------------------------------|
| GET    | `/artisans`         | Public   | Browse artisan profiles      |
| GET    | `/artisans/:id`     | Public   | Get artisan profile          |
| POST   | `/artisans/profile` | Required | Create artisan profile       |
| PATCH  | `/artisans/profile` | Required | Update own artisan profile   |

### Bookings — `/bookings`

| Method | Endpoint        | Auth     | Description           |
|--------|-----------------|:--------:|-----------------------|
| POST   | `/bookings`     | Required | Create a booking      |
| GET    | `/bookings`     | Required | List own bookings     |
| GET    | `/bookings/:id` | Required | Get booking details   |
| PATCH  | `/bookings/:id` | Required | Update booking status |

### Payments — `/payments`

| Method | Endpoint                        | Auth     | Description                            |
|--------|---------------------------------|:--------:|----------------------------------------|
| POST   | `/payments/initiate/:bookingId` | Required | Start a payment session for a booking  |
| GET    | `/payments/booking/:bookingId`  | Required | Get payment status                     |
| POST   | `/payments/webhook/paystack`    | Public*  | Paystack event webhook (HMAC-verified) |
| POST   | `/payments/webhook/stripe`      | Public*  | Stripe event webhook (HMAC-verified)   |

*Webhook routes are unauthenticated by design (payment providers cannot send Bearer tokens). They are secured by HMAC signature verification inside the service.

### Bank Accounts — `/bank-accounts`

| Method | Endpoint             | Auth     | Description               |
|--------|----------------------|:--------:|---------------------------|
| POST   | `/bank-accounts`     | Required | Add a payout bank account |
| GET    | `/bank-accounts`     | Required | List own bank accounts    |
| DELETE | `/bank-accounts/:id` | Required | Remove a bank account     |

### Notifications — `/notifications`

| Method | Endpoint                  | Auth     | Description                 |
|--------|---------------------------|:--------:|-----------------------------|
| GET    | `/notifications`          | Required | List own notifications      |
| PATCH  | `/notifications/:id/read` | Required | Mark notification as read   |

### Saved Addresses — `/saved-addresses`

| Method | Endpoint               | Auth     | Description            |
|--------|------------------------|:--------:|------------------------|
| POST   | `/saved-addresses`     | Required | Save a new address     |
| GET    | `/saved-addresses`     | Required | List saved addresses   |
| PATCH  | `/saved-addresses/:id` | Required | Update saved address   |
| DELETE | `/saved-addresses/:id` | Required | Delete saved address   |

### Reviews — `/reviews`

| Method | Endpoint              | Auth     | Description                    |
|--------|-----------------------|:--------:|--------------------------------|
| POST   | `/reviews`            | Required | Submit a review for an artisan |
| GET    | `/reviews/:artisanId` | Public   | Get reviews for an artisan     |

### Service Categories — `/service-categories`

| Method | Endpoint                  | Auth   | Description                 |
|--------|---------------------------|:------:|-----------------------------|
| GET    | `/service-categories`     | Public | List all service categories |
| POST   | `/service-categories`     | ADMIN  | Create a category           |
| PATCH  | `/service-categories/:id` | ADMIN  | Update a category           |
| DELETE | `/service-categories/:id` | ADMIN  | Delete a category           |

### Error Response Format

All errors follow a consistent envelope:

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

---

## Security

This section describes the security controls implemented in the API.

### Authentication & Authorisation
- **Stateless JWT** access tokens (short-lived, 15 min) + **rotating refresh tokens** (7 days) stored as bcrypt hashes in the database — a stolen refresh token cannot be replayed after rotation.
- **Role-based access control (RBAC):** roles `CUSTOMER`, `ARTISAN`, `ADMIN` enforced via `RolesGuard` and `@Roles()` metadata on every restricted route.
- **Password hashing:** bcrypt with a cost factor of 12 (never stored or logged in plaintext).

### Input Validation
- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` — unknown properties are stripped and rejected before reaching any handler.
- All DTOs use `class-validator` decorators enforcing type, format, and length constraints.

### Payment Webhook Security
- Paystack and Stripe webhook handlers verify HMAC-SHA512/256 signatures before processing any event. Requests with invalid or missing signatures are rejected with `401`.

### What to add before going live

| Control               | How to add                                                     |
|-----------------------|----------------------------------------------------------------|
| **Security headers**  | `npm install helmet` → `app.use(helmet())` in `main.ts`        |
| **Rate limiting**     | `npm install @nestjs/throttler` → configure `ThrottlerModule`  |
| **CORS**              | `app.enableCors({ origin: ['https://your-domain.com'] })`      |
| **HTTPS**             | Terminate TLS at a reverse proxy (nginx, Caddy) or load balancer — never expose the Node process directly on port 443 |
| **Audit logging**     | Add a `LoggingInterceptor` to record actor, action, and resource on every mutating request |
| **SQL injection**     | Already mitigated — all queries go through Prisma's parameterised query builder |

### Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.  
Email the maintainer directly with a description of the issue, reproduction steps, and potential impact. We aim to acknowledge reports within 48 hours.

---

## Testing

```bash
# Run all unit tests (single pass)
npm test

# Unit tests in interactive watch mode
npm run test:watch

# Generate HTML/lcov coverage report (output: coverage/)
npm run test:cov

# End-to-end tests against a real database
npm run test:e2e
```

Unit tests live alongside their source files (`*.spec.ts`). E2E tests live in `test/`.

---

## Deployment

### Pre-deployment Checklist

Before deploying to any environment, verify the following:

- [ ] All environment variables are set (no `.env.example` placeholders remain)
- [ ] `NODE_ENV` is set to `production`
- [ ] `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are each at least 32 characters, cryptographically random, and unique per environment
- [ ] `DATABASE_URL` points to the production database with a **least-privilege** role (no `CREATE DATABASE` or `DROP TABLE` permissions)
- [ ] `npx prisma migrate deploy` has been run successfully
- [ ] Helmet, rate limiting, and CORS are configured in `main.ts`
- [ ] HTTPS is enforced — either at the load balancer or reverse proxy level
- [ ] Webhook endpoints have been registered in Paystack and Stripe dashboards
- [ ] Firebase service account credentials are stored in your secrets manager, not in version control
- [ ] File upload directory (`uploads/`) is backed by object storage (S3/R2) in multi-instance deployments

---

### PM2 / VPS

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Build
npm run build

# 3. Run migrations
npx prisma migrate deploy --config prisma.config.ts

# 4. Start with PM2
pm2 start dist/main.js --name fix-connect-api --env production

# 5. Persist across reboots
pm2 save
pm2 startup
```

Sample nginx reverse-proxy config (place in `/etc/nginx/sites-available/fixconnect`):

```nginx
server {
    listen 443 ssl http2;
    server_name api.fixconnect.com;

    ssl_certificate     /etc/letsencrypt/live/api.fixconnect.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fixconnect.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Railway / Render / Fly.io

| Setting          | Value                                                             |
|------------------|-------------------------------------------------------------------|
| Build command    | `npm ci && npm run build`                                         |
| Start command    | `npm run start:prod`                                              |
| Pre-deploy hook  | `npx prisma migrate deploy --config prisma.config.ts`             |
| Health check     | `GET /api/v1` → HTTP 200                                          |
| Port             | Set `PORT` env var to match the platform's dynamic port           |
| Secrets          | Add all variables via the platform's secret/environment dashboard — never commit them |

---

### Docker

Create a `.dockerignore` file in the project root to keep the image lean and avoid leaking secrets:

```
node_modules
dist
.env
.env.*
coverage
*.log
uploads
```

**Dockerfile** (multi-stage, non-root user):

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npx prisma generate --config prisma.config.ts

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user for runtime security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json  ./package.json

# Ensure the upload directory exists and is owned by appuser
RUN mkdir -p uploads/avatars uploads/work-samples \
    && chown -R appuser:appgroup uploads

USER appuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1 || exit 1

CMD ["npm", "run", "start:prod"]
```

```bash
# Build
docker build -t fix-connect-api:latest .

# Run (secrets from env file — never bake into the image)
docker run -d \
  --name fix-connect-api \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  fix-connect-api:latest
```

> **Never use `COPY .env .`** inside a Dockerfile. Pass secrets at runtime via `--env-file` or your orchestrator's secret injection (Kubernetes Secrets, Docker Swarm secrets, etc.).

---

### File Uploads in Production

The default Multer configuration writes files to the local `uploads/` directory. This is unsuitable for production deployments with:

- Multiple replicas (files won't be shared across instances)
- Ephemeral containers (files are lost on restart)

**Recommended:** swap Multer's `diskStorage` for an S3-compatible storage engine (e.g. `multer-s3`) backed by AWS S3 or Cloudflare R2, and update the static asset serving in `main.ts` to point to your CDN URL.

---

## Contributing

1. Fork the repository and create a feature branch from `main`:  
   `git checkout -b feature/your-feature-name`
2. Write tests for all new or changed behaviour.
3. Ensure `npm test` and `npm run test:e2e` pass before opening a PR.
4. Follow [Conventional Commits](https://www.conventionalcommits.org) for commit messages (`feat:`, `fix:`, `docs:`, `chore:`, etc.).
5. Open a pull request against `main` with a clear description of the change and its motivation.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of notable changes.  
This project follows [Semantic Versioning](https://semver.org).

---

<div align="center">
Built with NestJS &amp; Prisma &mdash; FixConnect &copy; 2026
</div>
