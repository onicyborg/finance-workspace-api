# Finance Workspace API

NestJS + Prisma (PostgreSQL) API for the Finance Workspace application.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT Access + Refresh (multi-device sessions, refresh rotation, session-bound access tokens)
- **Docs**: Swagger (`/docs`)

## Prerequisites

- Node.js (LTS recommended)
- pnpm
- PostgreSQL (local) or Docker

## Quick Start (from GitHub)

### 1) Clone repository

```bash
git clone <YOUR_REPO_URL>
cd finance-workspace-api
```

### 2) Install dependencies

```bash
pnpm install
```

### 3) Setup environment variables

Create a `.env` file in the project root.

Minimal example:

```bash
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/finance?schema=public"

# JWT
JWT_SECRET="change-me"
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password hashing
BCRYPT_SALT_ROUNDS=10

# SMTP (required for email verification / forgot password)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Finance Workspace <no-reply@example.com>"
```

### 4) Start PostgreSQL

If you want to use Docker:

```bash
docker compose up -d
```

Or run PostgreSQL locally and ensure it matches your `DATABASE_URL`.

### 5) Prisma generate + migrate

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 6) Run the server

```bash
pnpm start:dev
```

The API will be served with a global prefix:

- **Base URL**: `http://localhost:3000/api`

## API Documentation (Swagger)

After running the server, open:

- `http://localhost:3000/docs`

If you test protected endpoints (Bearer token), click **Authorize** and paste your access token.

## Troubleshooting

### Port already in use (`EADDRINUSE`)

If port `3000` is already used, set another port:

```bash
PORT=3001 pnpm start:dev
```

### 404 when hitting endpoints

This project uses `app.setGlobalPrefix('api')`, so ensure you call:

- `.../api/auth/...` (NOT `.../auth/...`)
