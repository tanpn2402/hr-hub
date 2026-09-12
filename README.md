# hr-hub

Turborepo (npm workspaces) monorepo for internal HR tooling.

## Apps

| App | Path | What it is |
|---|---|---|
| `late-hub` | [apps/late-hub](apps/late-hub) | NestJS backend — employee portal for checking late hours and submitting attendance fines |
| `late-hub-ui` | [apps/late-hub-ui](apps/late-hub-ui) | Vite/React frontend for `late-hub` |
| `web` | [apps/web](apps/web) | Vite/TypeScript starter app |
| `idenplane` | [apps/idenplane](apps/idenplane) | Self-hosted IAM server ([idenplane/idenplane](https://github.com/idenplane/idenplane)), vendored into this monorepo and configured to run on SQLite for local dev — see [setup below](#idenplane-initial-setup) |
| `idenplane` admin console | [apps/idenplane/admin-ui](apps/idenplane/admin-ui) | React admin console for `idenplane`, served at `/console` |

Shared packages live under `packages/*` (ESLint config, TS config, UI components).

## Prerequisites

- Node **22** (see `.nvmrc`). If your shell's default Node is older, switch first:
  ```bash
  nvm use 22
  ```
- npm 10+

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` runs every app's own `dev` script in parallel via Turborepo. First-time setup for `idenplane` needs a couple of extra one-off steps — see below.

### Ports

| App | Port |
|---|---|
| `late-hub` API | `3003` |
| `late-hub-ui` | `5174` (Vite default, may shift if taken) |
| `web` | `5173` (Vite default, may shift if taken) |
| `idenplane` API | `3000` (fixed via `PORT` in `apps/idenplane/.env`) |
| `idenplane` admin-ui | `5173` (Vite default; auto-increments to the next free port when other apps already hold `5173`/`5174` — commonly lands on `5175` when running the full `npm run dev`) |

## idenplane initial setup

`idenplane` is a full IAM server (OAuth2/OIDC/SAML/WebAuthn, Prisma-backed) normally run against PostgreSQL. For local dev in this monorepo it's configured to run on **SQLite** instead, so there's no database server to stand up. On a fresh clone, do this once:

```bash
cd apps/idenplane

# 1. Environment
cp .env.example .env
```

Then edit `apps/idenplane/.env`:

- Set `DATABASE_URL=file:./dev.db` (the `.env.example` default is a Postgres URL — the schema in this repo is already configured for SQLite, see note below, so just point `DATABASE_URL` at a local file).
- Generate real secrets and set them (don't leave the placeholders):
  ```bash
  openssl rand -hex 32   # → ADMIN_API_KEY
  openssl rand -hex 32   # → WEBHOOK_SECRET_KEY
  openssl rand -hex 16   # → WEBHOOK_ENCRYPTION_SALT
  ```
- Set `ADMIN_PASSWORD` to whatever you want the initial admin login to be (defaults to the placeholder string otherwise — see [Admin login](#admin-login)).

```bash
# 2. Install deps (from repo root; idenplane + its admin-ui are both npm workspaces)
cd ../..
npm install

# 3. Create the SQLite database from the schema
npx --workspace=idenplane prisma db push

# 4. (Optional) seed a sample realm/user/client for manual testing
npm run prisma:seed --workspace=idenplane
```

Now `npm run dev` (from the repo root) will boot idenplane's API and admin-ui along with everything else. On first boot, `AdminSeedService` automatically creates a `master` realm and an `admin` user using `ADMIN_USER`/`ADMIN_PASSWORD` from `.env`.

> **Note on the schema:** `prisma/schema.prisma` in this repo is already the SQLite variant (the upstream project ships separate `schema.prisma` / `schema.sqlite.prisma` / `schema.mysql.prisma` files and a `./scripts/use-sqlite.sh` helper to switch between them — that switch has already been applied here, plus several fields the upstream SQLite schema was missing were added directly). You should not need to run `use-sqlite.sh` again on a fresh clone of this repo.
>
> **Note on migrations:** the existing `prisma/migrations/*` are hand-written PostgreSQL SQL and can't run against SQLite, so local dev uses `prisma db push` (syncs the schema directly) instead of `prisma migrate dev`. If you change `prisma/schema.prisma`, just re-run `npx --workspace=idenplane prisma db push`.

### Admin login

- URL: `http://localhost:<admin-ui-port>/console` (see [Ports](#ports) — commonly `:5175` when running the full monorepo)
- Username: value of `ADMIN_USER` in `.env` (defaults to `admin`)
- Password: value of `ADMIN_PASSWORD` in `.env`

If you change `ADMIN_PASSWORD` after the app has already booted once, it won't retroactively update the seeded user — delete `apps/idenplane/dev.db`, re-run `npx --workspace=idenplane prisma db push`, and restart the app so it reseeds with the new password.

## Scripts

- `npm run dev` — run all apps in dev/watch mode
- `npm run build` — build all apps
- `npm run lint` — lint all apps
- `npm run format` — Prettier over the whole repo
