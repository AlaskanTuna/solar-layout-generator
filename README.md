# Solar Layout Generator

A web-based tool for Malaysian homeowners to assess rooftop solar potential using Google Solar API satellite data. Users search for their property, view an auto-generated solar panel layout on a satellite image, interactively adjust it and receive NEM Rakyat 3.0 financial projections with PDF export.

---

## Features

- **Satellite-based rooftop analysis** — Google Solar API provides real solar flux data and rooftop imagery
- **Interactive panel workbench** — drag, rotate, add/remove panels on a Konva.js canvas with real-time energy recalculation
- **NEM billing simulation** — accurate projection using post-July 2025 RP4 tariff rates, EEI rebates, AFA, SST and RE Fund
- **PDF report export** — downloadable analysis with system summary, monthly breakdown and financial projections
- **Project management** — save multiple projects, revisit and revise layouts

---

## Architecture

```
Frontend (React + Vite + Konva.js)  ↔  REST API  ↔  Backend (Express.js + Prisma)  ↔  Supabase (PostgreSQL + Auth + Storage)  ↔  Google Solar API + Google Maps API
```

Monorepo with pnpm workspaces:

| Workspace   | Purpose                                                   |
| ----------- | --------------------------------------------------------- |
| `/shared`   | Shared TypeScript types consumed by both sides            |
| `/backend`  | Express.js API server, Solar pipeline, GeoTIFF processing |
| `/frontend` | React SPA with Konva.js canvas and Recharts               |

---

## Tech Stack

| Layer      | Technologies                                                              |
| ---------- | ------------------------------------------------------------------------- |
| Frontend   | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, Konva.js, Recharts |
| Backend    | Express.js, TypeScript, Prisma ORM, Zod                                   |
| Database   | Supabase (PostgreSQL + Auth + Storage)                                    |
| Processing | geotiff.js, sharp, proj4                                                  |
| APIs       | Google Solar API, Google Maps JavaScript API                              |

---

## Prerequisites

- **Node.js** 24.x
- **pnpm** 10.x via Corepack (`corepack enable`)
- **Supabase project** with PostgreSQL, Auth enabled and a Storage bucket named `geotiffs`
- **Google Cloud project** with these APIs enabled:
  - Solar API
  - Maps JavaScript API
  - Geocoding API (for address search)

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/solar-layout-generator.git
cd solar-layout-generator
corepack enable
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable                    | Description                                   |
| --------------------------- | --------------------------------------------- |
| `GOOGLE_SOLAR_API_KEY`      | Google Cloud API key with Solar API enabled   |
| `GOOGLE_MAPS_API_KEY`       | Google Cloud API key with Maps JS API enabled |
| `SUPABASE_PROJECT_URL`      | Your Supabase project URL                     |
| `SUPABASE_ANON_KEY`         | Supabase anonymous/public key                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only)      |
| `SUPABASE_DATABASE_URL`     | Direct PostgreSQL connection string           |
| `VITE_SUPABASE_URL`         | Same as `SUPABASE_PROJECT_URL` (frontend)     |
| `VITE_SUPABASE_ANON_KEY`    | Same as `SUPABASE_ANON_KEY` (frontend)        |
| `VITE_GOOGLE_MAPS_API_KEY`  | Same as `GOOGLE_MAPS_API_KEY` (frontend)      |
| `GOOGLE_OAUTH_CLIENT_ID`    | Google OAuth 2.0 client ID (for SSO)          |
| `GOOGLE_OAUTH_SECRET`       | Google OAuth 2.0 client secret (for SSOs)     |

### 3. Set up the database

```bash
pnpm db:migrate    # Run Prisma migrations
pnpm db:seed       # Seed Malaysian tariff configuration
```

### 4. Start the dev servers

```bash
pnpm dev           # Starts both frontend (port 5173) and backend (port 3001) concurrently
```

Or run them separately:

```bash
pnpm dev:backend   # Backend only (port 3001)
pnpm dev:frontend  # Frontend only (port 5173)
```

The frontend proxies `/api` requests to the backend in development.

---

## Commands

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start frontend + backend concurrently |
| `pnpm dev:backend`  | Start backend only                    |
| `pnpm dev:frontend` | Start frontend only                   |
| `pnpm build`        | Build all workspaces for production   |
| `pnpm test`         | Run frontend + backend unit tests     |
| `pnpm format`       | Run Prettier across the repo          |
| `pnpm db:migrate`   | Run Prisma migrations                 |
| `pnpm db:seed`      | Seed tariff config data               |
| `pnpm exec vitest`  | Run unit tests                        |

---

## Project Structure

```
solar-layout-generator/
├── shared/                 # Shared TypeScript types
│   └── index.ts
├── supabase/
│   ├── config.toml         # Supabase project config (auth, email, OAuth)
│   └── templates/          # Branded auth email templates
├── backend/
│   └── src/
│       ├── config/         # Environment, Prisma, Supabase clients
│       ├── geo/            # Coordinate transforms, flux sampling
│       ├── middleware/      # Auth, validation, error handling
│       ├── routes/         # API route handlers
│       ├── services/       # Solar pipeline, location service
│       └── app.ts          # Express app setup
├── frontend/
│   └── src/
│       ├── api/            # Typed API client layer
│       ├── components/     # UI components (shadcn/ui + custom)
│       ├── hooks/          # React hooks (auth, panels, data)
│       ├── lib/            # Billing engine, transforms, utilities
│       └── pages/          # Route page components
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Tariff data seeding
└── tests/
    └── smoke/              # Smoke test scripts
```

---

## Heroku Deployment

The app is configured for Heroku deployment with a single web dyno.

### Recommended: GitHub Actions CI/CD

The repo now includes [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

It behaves like this:

- Pull requests run pnpm install, build and unit tests only
- Pushes to `main` run the same CI checks, then deploy the passing commit to Heroku automatically
- Deployment still uses your existing Heroku Git app endpoint, so Heroku continues to build the app with the current `Procfile` and `heroku-postbuild`
- Heroku now detects `pnpm-lock.yaml`, installs the exact pnpm version from `packageManager` and builds the app with pnpm
- The old `package-lock.json` should stay out of the repo so Heroku and contributors do not accidentally fall back to npm

Before the workflow can deploy, add these GitHub repository secrets:

- `HEROKU_API_KEY`: your Heroku API key
- `HEROKU_APP_NAME`: your Heroku app name, for example `solar-layout-generator`

After that, your normal release flow becomes:

```bash
git push origin <branch>    # open a PR as usual
# merge into main
# GitHub Actions runs CI and deploys to Heroku automatically
```

### Initial Heroku setup

These commands are still useful once when creating the app or updating config vars manually:

```bash
# Initial setup
heroku create <app-name>
heroku config:push -f .env          # make sure .env is filled with credentials
heroku open                         # or click URL manually
```

### Manual Fallback Deploy

```bash
git push heroku main                # deploy to Heroku
```

With the workflow configured, you should not need `git push heroku main` for normal releases. Keep it only as an emergency/manual fallback.

The `heroku-postbuild` script still builds all workspaces on Heroku. The `Procfile` now starts the app with `pnpm start` and the Express server serves the frontend static files in production.

> **Note:** This project uses Express 5 with `path-to-regexp` v8+, which requires named catch-all parameters (e.g. `'{*path}'` instead of `'*'`).

---

## Testing

```bash
# Run all unit tests
pnpm test

# Run backend tests only
pnpm --filter backend test

# Run frontend tests only
pnpm --filter frontend test

# Smoke tests (requires running backend + valid env)
bash tests/smoke/smoke-authz.sh
```

---

## License

This project is developed as a Final Year Project and is not currently licensed for commercial use.

---

## Acknowledgements

- [Google Solar API](https://developers.google.com/maps/documentation/solar) for rooftop solar potential data
- [Suruhanjaya Tenaga (Energy Commission)](https://www.st.gov.my/) for Malaysian tariff rate references
- Aligned with [UN SDG 7: Affordable and Clean Energy](https://sdgs.un.org/goals/goal7)
