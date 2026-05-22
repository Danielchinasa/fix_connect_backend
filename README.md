# FixConnect Backend

A RESTful API backend for the **FixConnect** platform — a marketplace that connects customers with skilled artisans for home repairs, maintenance, and professional services. Built with NestJS, Prisma ORM, and PostgreSQL.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | [NestJS 11](https://nestjs.com)     |
| Language     | TypeScript 5                        |
| ORM          | [Prisma 7](https://www.prisma.io)   |
| Database     | PostgreSQL 14+                      |
| Auth         | JWT (access + refresh tokens)       |
| Validation   | class-validator / class-transformer |
| File Uploads | Multer (local disk storage)         |
| Payments     | Paystack (primary) / Stripe         |
| Push Notifs  | Firebase Cloud Messaging (FCM)      |

---

## Project Structure

```
src/
├── app.module.ts               # Root module
├── main.ts                     # Bootstrap (port, global prefix, validation pipe)
├── auth/                       # JWT auth, OTP, password reset
├── users/                      # User profiles & management
├── artisans/                   # Artisan profiles & availability
├── bookings/                   # Service booking lifecycle
├── payments/                   # Payment initiation, webhooks, escrow
│   └── gateways/               # Paystack & Stripe gateway adapters
├── bank-accounts/              # Artisan payout bank accounts
├── notifications/              # In-app & push notifications
├── reviews/                    # Customer reviews for artisans
├── saved-addresses/            # Customer saved locations
├── service-categories/         # Service category management
├── email/                      # Transactional email service
└── prisma/                     # Prisma client module

prisma/
├── schema.prisma               # Database schema & models
└── migrations/                 # Migration history

uploads/
├── avatars/                    # User avatar files (served as static assets)
└── work-samples/               # Artisan work sample images
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **PostgreSQL** v14 or higher
- **NestJS CLI** *(optional, for code generation)*: `npm i -g @nestjs/cli`

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable                 | Description                                           | Example                                               |
|--------------------------|-------------------------------------------------------|-------------------------------------------------------|
| `NODE_ENV`               | Runtime environment                                   | `development`                                         |
| `PORT`                   | HTTP port the server listens on                       | `3000`                                                |
| `DATABASE_URL`           | PostgreSQL connection string                          | `postgresql://user:pass@localhost:5432/fixconnect_db` |
| `JWT_ACCESS_SECRET`      | Secret for signing access tokens                      | *(64-char random hex string)*                         |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifetime                                 | `15m`                                                 |
| `JWT_REFRESH_SECRET`     | Secret for signing refresh tokens                     | *(64-char random hex string)*                         |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime                                | `7d`                                                  |
| `OTP_EXPIRY_MINUTES`     | OTP validity window in minutes                        | `10`                                                  |
| `PAYSTACK_SECRET_KEY`    | Paystack secret key (from Paystack dashboard)         | `sk_test_...`                                         |
| `PAYSTACK_PUBLIC_KEY`    | Paystack public key                                   | `pk_test_...`                                         |
| `FIREBASE_PROJECT_ID`    | Firebase project ID for push notifications            | `fixconnect-prod`                                     |
| `FIREBASE_PRIVATE_KEY`   | Firebase service account private key                  | `-----BEGIN RSA PRIVATE KEY-----...`                  |
| `FIREBASE_CLIENT_EMAIL`  | Firebase service account email                        | `firebase-adminsdk@...gserviceaccount.com`            |

> **Security:** Never commit your `.env` file — it is already listed in `.gitignore`. Generate strong secrets for production with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Danielchinasa/fix_connect_backend.git
cd fix_connect_backend

# Install dependencies
npm install
```

---

## Database Setup

```bash
# Apply all migrations to your database
npx prisma migrate deploy --config prisma.config.ts

# (Development only) Create a new migration after editing schema.prisma
npx prisma migrate dev --config prisma.config.ts

# Regenerate the Prisma client after schema changes
npx prisma generate --config prisma.config.ts

# Open Prisma Studio — browse & edit data in a browser UI
npx prisma studio --config prisma.config.ts
```

---

## Running the Application

```bash
# Development — hot-reload on file changes
npm run start:dev

# Debug mode
npm run start:debug

# Production — compile first, then run
npm run build
npm run start:prod
```

Once running, the API is available at:

- **API base URL:** `http://localhost:3000/api/v1`
- **Static uploads:** `http://localhost:3000/uploads/`

---

## API Overview

All routes are prefixed with `/api/v1`. Protected routes require an `Authorization: Bearer <access_token>` header.

### Auth — `/api/v1/auth`

| Method | Endpoint                 | Auth     | Description                                      |
|--------|--------------------------|----------|--------------------------------------------------|
| POST   | `/auth/signup`           | Public   | Register a new user                              |
| POST   | `/auth/login`            | Public   | Login and receive access + refresh tokens        |
| POST   | `/auth/refresh`          | Public   | Exchange a refresh token for a new access token  |
| POST   | `/auth/logout`           | Public   | Invalidate a refresh token                       |
| GET    | `/auth/me`               | Required | Get the currently authenticated user's profile   |
| POST   | `/auth/otp/send`         | Public   | Send OTP (email verification or forgot password) |
| POST   | `/auth/otp/verify-email` | Public   | Verify email address with OTP code               |
| POST   | `/auth/forgot-password`  | Public   | Send a password reset OTP                        |
| POST   | `/auth/reset-password`   | Public   | Set new password using OTP code                  |

### Users — `/api/v1/users`

| Method | Endpoint      | Auth       | Description         |
|--------|---------------|------------|---------------------|
| GET    | `/users`      | ADMIN only | List all users      |
| GET    | `/users/:id`  | Required   | Get a user by ID    |
| PATCH  | `/users/:id`  | Required   | Update user profile |

### Artisans — `/api/v1/artisans`

| Method | Endpoint            | Auth     | Description                  |
|--------|---------------------|----------|------------------------------|
| GET    | `/artisans`         | Public   | Browse all artisan profiles  |
| GET    | `/artisans/:id`     | Public   | Get a single artisan profile |
| POST   | `/artisans/profile` | Required | Create an artisan profile    |
| PATCH  | `/artisans/profile` | Required | Update own artisan profile   |

### Bookings — `/api/v1/bookings`

| Method | Endpoint        | Auth     | Description            |
|--------|-----------------|----------|------------------------|
| POST   | `/bookings`     | Required | Create a new booking   |
| GET    | `/bookings`     | Required | List own bookings      |
| GET    | `/bookings/:id` | Required | Get booking details    |
| PATCH  | `/bookings/:id` | Required | Update booking status  |

### Payments — `/api/v1/payments`

| Method | Endpoint                        | Auth     | Description                            |
|--------|---------------------------------|----------|----------------------------------------|
| POST   | `/payments/initiate/:bookingId` | Required | Initiate payment for a booking         |
| GET    | `/payments/booking/:bookingId`  | Required | Get current payment status             |
| POST   | `/payments/webhook/paystack`    | Public   | Paystack webhook handler (HMAC-signed) |
| POST   | `/payments/webhook/stripe`      | Public   | Stripe webhook handler (HMAC-signed)   |

### Bank Accounts — `/api/v1/bank-accounts`

| Method | Endpoint             | Auth     | Description               |
|--------|----------------------|----------|---------------------------|
| POST   | `/bank-accounts`     | Required | Add a payout bank account |
| GET    | `/bank-accounts`     | Required | List own bank accounts    |
| DELETE | `/bank-accounts/:id` | Required | Remove a bank account     |

### Notifications — `/api/v1/notifications`

| Method | Endpoint                  | Auth     | Description                 |
|--------|---------------------------|----------|-----------------------------|
| GET    | `/notifications`          | Required | List own notifications      |
| PATCH  | `/notifications/:id/read` | Required | Mark a notification as read |

### Saved Addresses — `/api/v1/saved-addresses`

| Method | Endpoint               | Auth     | Description            |
|--------|------------------------|----------|------------------------|
| POST   | `/saved-addresses`     | Required | Save a new address     |
| GET    | `/saved-addresses`     | Required | List saved addresses   |
| PATCH  | `/saved-addresses/:id` | Required | Update a saved address |
| DELETE | `/saved-addresses/:id` | Required | Delete a saved address |

### Reviews — `/api/v1/reviews`

| Method | Endpoint               | Auth     | Description                    |
|--------|------------------------|----------|--------------------------------|
| POST   | `/reviews`             | Required | Submit a review for an artisan |
| GET    | `/reviews/:artisanId`  | Public   | Get all reviews for an artisan |

### Service Categories — `/api/v1/service-categories`

| Method | Endpoint                  | Auth       | Description                 |
|--------|---------------------------|------------|-----------------------------|
| GET    | `/service-categories`     | Public     | List all service categories |
| POST   | `/service-categories`     | ADMIN only | Create a new category       |
| PATCH  | `/service-categories/:id` | ADMIN only | Update a category           |
| DELETE | `/service-categories/:id` | ADMIN only | Delete a category           |

---

## Testing

```bash
# Run all unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

---

## Deployment

### 1. Build

```bash
npm run build
```

This compiles TypeScript to the `dist/` directory.

### 2. Run Database Migrations

Always run migrations before starting the server in production:

```bash
npx prisma migrate deploy --config prisma.config.ts
```

Use `migrate deploy` (not `migrate dev`) in production — it applies pending migrations without interactive prompts.

### 3. Start the Server

```bash
# Direct node
npm run start:prod

# With PM2 (recommended for VPS / dedicated server)
pm2 start dist/main.js --name fix-connect-api
pm2 save
pm2 startup
```

---

### Deploying to Railway / Render / Fly.io

| Setting       | Value                                                        |
|---------------|--------------------------------------------------------------|
| Build command | `npm run build`                                              |
| Start command | `npm run start:prod`                                         |
| Pre-deploy    | `npx prisma migrate deploy --config prisma.config.ts`        |
| Health check  | `GET /api/v1`                                                |
| Port          | Set `PORT` env var to match the platform's expected port     |

Add all variables from the [Environment Variables](#environment-variables) section in your platform's dashboard.

---

### Deploying with Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

```bash
# Build the image
docker build -t fix-connect-api .

# Run with your env file
docker run -p 3000:3000 --env-file .env fix-connect-api
```

---

### File Uploads in Production

By default, uploaded files (avatars, work samples) are stored in the local `uploads/` directory. For multi-instance or containerised deployments, replace Multer's disk storage with an object storage provider such as **AWS S3** or **Cloudflare R2** to ensure files persist across restarts and scale across replicas.

---

## License

UNLICENSED — private project.
