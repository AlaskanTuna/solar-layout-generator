# Solar Layout Generator

A web-based tool for Malaysian homeowners to assess rooftop solar potential using Google Solar API satellite data. Users search for their property, view an auto-generated solar panel layout on a satellite image, interactively adjust it, and receive NEM Rakyat 3.0 financial projections with PDF export.

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

Monorepo with npm workspaces:

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

- **Node.js** 20+ and npm
- **Supabase project** with PostgreSQL, Auth enabled, and a Storage bucket named `geotiffs`
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
npm install
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

### 3. Set up the database

```bash
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed Malaysian tariff configuration
```

### 4. Start the dev servers

```bash
npm run dev           # Starts both frontend (port 5173) and backend (port 3001) concurrently
```

Or run them separately:

```bash
npm run dev:backend   # Backend only (port 3001)
npm run dev:frontend  # Frontend only (port 5173)
```

The frontend proxies `/api` requests to the backend in development.

---

## Commands

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `npm run dev`          | Start frontend + backend concurrently |
| `npm run dev:backend`  | Start backend only                    |
| `npm run dev:frontend` | Start frontend only                   |
| `npm run build`        | Build all workspaces for production   |
| `npm run format`       | Run Prettier across the repo          |
| `npm run db:migrate`   | Run Prisma migrations                 |
| `npm run db:seed`      | Seed tariff config data               |
| `npx vitest`           | Run unit tests                        |

---

## Project Structure

```
solar-layout-generator/
├── shared/                 # Shared TypeScript types
│   └── index.ts
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
├── tests/
│   └── smoke/              # Smoke test scripts
└── docs/                   # Project documentation (PRD, TRD, etc.)
```

---

## Deployment (Heroku)

The app is configured for Heroku deployment with a single web dyno:

```bash
heroku create <app-name>
heroku config:set NODE_ENV=production GOOGLE_SOLAR_API_KEY=... GOOGLE_MAPS_API_KEY=... # (set all env vars)
git push heroku main
```

The `heroku-postbuild` script builds all workspaces. The Express server serves the frontend static files in production.

---

## Testing

```bash
# Run all unit tests
npx vitest

# Run backend tests only
npm exec --workspace=backend -- vitest run

# Run frontend tests only
npm run test --workspace=frontend

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
