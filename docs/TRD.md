# Technical Requirements Document (TRD)

## Solar Layout Generator — Architecture & Implementation Reference

> **Version:** 1.0 · **Status:** Draft · **Last Updated:** 2026-03-05
> **Source:** Derived from the FYP Project Proposal (`fyp-project-proposal.md`)
> **Companion:** See `PRD.md` for product requirements and acceptance criteria. See `PROTOTYPE.md` for solar layout generator prototype.

---

## 1. System Architecture

Full-stack SaaS web application with a React frontend and Express.js backend, backed by Supabase (PostgreSQL + Auth + Storage).

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                    │
│  ┌──────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │ MapPage  │→ │ WorkbenchPage │→ │ AnalysisPage          │ │
│  │ (Page 1) │  │ (Page 2)      │  │ (Page 3)              │ │
│  │          │  │ Konva.js      │  │ Billing Engine (local) │ │
│  └──────────┘  └───────────────┘  └───────────────────────┘ │
│                    ↕ REST API                                │
├─────────────────────────────────────────────────────────────┤
│  Backend (Express.js + TypeScript)                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Location   │  │ Flux Sampler │  │ GeoTIFF Processor    │ │
│  │ Resolver   │  │ (12 bands)   │  │ (RGB → PNG/WebP)     │ │
│  └────────────┘  └──────────────┘  └──────────────────────┘ │
│                    ↕ Prisma ORM                              │
├─────────────────────────────────────────────────────────────┤
│  Supabase                                                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth     │  │ PostgreSQL   │  │ Storage      │          │
│  │ (JWT)    │  │ (data, cache)│  │ (GeoTIFFs)   │          │
│  └──────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  External APIs                                              │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ Google Solar API     │  │ Google Maps JavaScript API   │ │
│  │ (buildingInsights,   │  │ (Autocomplete, Map display)  │ │
│  │  dataLayers)         │  │                              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Core Design Principle: Conservative API Usage

- **Backend caching:** `buildingInsights` and `dataLayers` responses cached per location in Supabase. Subsequent requests for the same coordinates return cached data.
- **Call once, use many times:** The expensive API endpoints are called only once per location. All subsequent pages reuse cached data.
- **Client-side state management:** Panel edits on the workbench require zero additional Solar API calls. Only flux recomputation hits the backend (using cached GeoTIFFs).

---

## 2. Technology Stack

### Frontend

| Technology                           | Purpose                       |
| ------------------------------------ | ----------------------------- |
| React + Vite                         | Core framework and dev server |
| TypeScript                           | Primary language              |
| shadcn/ui                            | UI component library          |
| lucide-react                         | Icon library                  |
| React Router                         | Client-side routing           |
| Tailwind CSS                         | Styling                       |
| TanStack Query                       | Data fetching, caching, state |
| @googlemaps/js-api-loader            | Google Maps integration       |
| Konva.js + react-konva               | Interactive canvas workbench  |
| html2pdf.js (or jsPDF + html2canvas) | Client-side PDF export        |

### Backend

| Technology            | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| Express.js on Node.js | REST API server                                  |
| TypeScript            | Backend language (shared types with frontend)    |
| Prisma                | ORM, migrations, seed scripts                    |
| Supabase              | PostgreSQL, Auth (JWT), Storage                  |
| Zod                   | Request validation                               |
| geotiff.js            | GeoTIFF reading and flux sampling                |
| sharp                 | Image format conversion (GeoTIFF RGB → PNG/WebP) |
| proj4                 | Coordinate transforms (EPSG:4326 ↔ GeoTIFF CRS)  |

### DevOps

| Technology        | Purpose                                  |
| ----------------- | ---------------------------------------- |
| ESLint + Prettier | Code quality                             |
| Vitest            | Unit testing (billing engine, flux math) |
| Git + GitHub      | Version control                          |
| Heroku            | Deployment (GitHub Student credits)      |

### Heroku Deployment Reference

**Architecture:** Single Basic dyno ($7/mo) runs the Express backend, which also serves the built frontend as static files. Supabase handles all stateful concerns (Postgres, Auth, Storage) externally.

**Key files:**

| File                                     | Purpose                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `Procfile`                               | Tells Heroku to start the backend: `web: npm run start --workspace=backend`       |
| `heroku-postbuild` (root `package.json`) | Runs after `npm install` — builds shared → Prisma → backend → frontend            |
| `env.ts`                                 | Accepts Heroku's dynamic `PORT`; falls back to `BACKEND_PORT` for local dev       |
| `app.ts`                                 | In production, serves `frontend/dist` as static files with React Router catch-all |

**Setup steps (once credits are active):**

```bash
# 1. Install CLI and authenticate
npm install -g heroku
heroku login

# 2. Create app
heroku create solar-layout-generator

# 3. Set environment variables (all from .env)
heroku config:set NODE_ENV=production \
  GOOGLE_SOLAR_API_KEY=... \
  GOOGLE_MAPS_API_KEY=... \
  SUPABASE_PROJECT_URL=... \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  SUPABASE_DATABASE_URL=...

# 4. Deploy
git push heroku main

# 5. Open
heroku open
```

---

## 3. Data Models

### 3.1 Location (Immutable)

Created once during Page 1's fetch pipeline. Never modified after creation. Multiple projects can reference the same location (cache hits).

| Field                  | Type      | Description                                              |
| ---------------------- | --------- | -------------------------------------------------------- |
| `id`                   | UUID      | Primary key                                              |
| `lat`                  | Float     | Confirmed latitude                                       |
| `lng`                  | Float     | Confirmed longitude                                      |
| `status`               | Enum      | `processing` · `ready` · `failed`                        |
| `buildingInsightsJson` | JSONB     | Enriched `buildingInsights` response (panels have IDs)   |
| `rgbImageUrl`          | String    | Supabase Storage URL for derived PNG/WebP                |
| `monthlyFluxPath`      | String    | Supabase Storage path for `monthly_flux.tif`             |
| `maskPath`             | String    | Supabase Storage path for `mask.tif`                     |
| `annualFluxPath`       | String    | Supabase Storage path for `annual_flux.tif` (future use) |
| `dsmPath`              | String    | Supabase Storage path for `dsm.tif` (future use)         |
| `createdAt`            | Timestamp | Creation time                                            |

### 3.2 Project (Mutable)

Created on Page 1 when user starts a new project. Updated on each workbench save (Page 2) and analysis save (Page 3).

| Field             | Type      | Description                                 |
| ----------------- | --------- | ------------------------------------------- |
| `id`              | UUID      | Primary key                                 |
| `userId`          | UUID      | FK → Supabase Auth user                     |
| `locationId`      | UUID      | FK → Location                               |
| `name`            | String    | User-defined project name                   |
| `status`          | Enum      | `draft` · `layout_saved` · `analysis_saved` |
| `editedLayout`    | JSONB     | Array of `PanelEdit` objects (from Page 2)  |
| `analysisConfig`  | JSONB     | Saved assumptions from Page 3               |
| `analysisResults` | JSONB     | Computed results from Page 3                |
| `createdAt`       | Timestamp | Creation time                               |
| `updatedAt`       | Timestamp | Last modified                               |

### 3.3 PanelEdit (JSONB within Project)

```typescript
type PanelEdit = {
  id: string // "panel_0" — references enriched solarPanels[]
  status: 'kept' | 'moved' | 'deleted'
  center: { lat: number; lng: number } // original or dragged position
  rotation: number // degrees, 0 if untouched
  monthlyEnergyDcKwh: number[] // 12 monthly kWh values, from monthlyFlux sampling
}
```

### 3.4 Tariff Config (Seeded)

Seeded via `prisma db seed`. Contains Malaysian electricity tariff rates, thresholds, and EEI table.

| Field            | Type   | Description                                   |
| ---------------- | ------ | --------------------------------------------- |
| `id`             | UUID   | Primary key                                   |
| `tariffVersion`  | String | e.g. "Tariff C1 2024"                         |
| `rates`          | JSONB  | Tiered rate structure (sen/kWh per threshold) |
| `thresholds`     | JSONB  | kWh thresholds (600, 1000, 1500)              |
| `eeiTable`       | JSONB  | Energy Exchange Incentive rates               |
| `afaRateDefault` | Float  | Default AFA rate (sen/kWh)                    |

---

## 4. API Endpoints

### 4.1 Location Resolution

```
POST /api/locations/resolve
Body: { lat: number, lng: number, projectId?: string }
Response: { locationId: string, status: "ready" | "processing" }
```

- Checks cache (existing location within coordinate tolerance)
- Cache hit: links project to location, returns `ready`
- Cache miss: creates location record (`processing`), starts fetch pipeline

```
GET /api/locations/:id/status
Response: { status: "processing" | "ready" | "failed" }
```

- Frontend polls this endpoint during Page 1 loading state

### 4.2 Location Data

```
GET /api/locations/:id/data
Response: {
  buildingInsights: { ... },   // enriched JSON with panel IDs
  rgbImageUrl: string,         // signed Supabase Storage URL
}
```

- Used by Page 2 on load to initialise the workbench

### 4.3 Flux Recomputation

```
POST /api/locations/:locationId/panels/recompute
Body: {
  panelId: string,
  center: { lat: number, lng: number },
  rotation: number,
}
Response: {
  monthlyEnergyDcKwh: number[]   // 12 values
}
```

- Backend derives panel pixel dimensions from `panelHeightMeters` / `panelWidthMeters` (stored in `buildingInsightsJson`) and the GeoTIFF's geo-transform. The frontend does not send pixel dimensions — this avoids mismatches between canvas scale and raster scale.
- Samples 12 bands of `monthlyFlux.tif` at the panel's updated footprint
- Returns recomputed monthly kWh array

### 4.4 Project CRUD

```
POST   /api/projects                    — Create project
GET    /api/projects                    — List user's projects
GET    /api/projects/:id                — Get project details
PATCH  /api/projects/:id/layout         — Save edited layout (PanelEdit[])
PATCH  /api/projects/:id/analysis       — Save analysis config + results
```

### 4.5 Tariff Configuration

```
GET /api/tariff/config
Response: {
  rates: { ... },
  thresholds: { ... },
  eeiTable: { ... },
  afaRateDefault: number,
}
```

- Loaded once on Page 3 page load. All billing simulation runs client-side.

---

## 5. Google Solar API Integration

### 5.1 buildingInsights Endpoint

**Called:** Once per location (Page 1 pipeline, cache miss only).

**Key fields consumed:**

| Field                                    | Used In | Purpose                                                         |
| ---------------------------------------- | ------- | --------------------------------------------------------------- |
| `solarPanels[]`                          | Page 2  | Per-panel positions, orientations, yield — the master inventory |
| `maxArrayPanelsCount`                    | Page 2  | Upper bound for panel slider                                    |
| `panelCapacityWatts`                     | Page 3  | Default wattage for kWp calculation                             |
| `panelHeightMeters` / `panelWidthMeters` | Page 2  | Fixed panel dimensions for canvas rendering                     |
| `carbonOffsetFactorKgPerMwh`             | Page 3  | Carbon offset calculation                                       |
| `roofSegmentStats[]`                     | Page 2  | Segment boundaries (optional visual grouping)                   |

**Enrichment:** Before storing, backend appends deterministic IDs to each panel:

```json
{ "id": "panel_0", "center": {...}, "orientation": "LANDSCAPE", "yearlyEnergyDcKwh": 538.4, "segmentIndex": 0 }
```

> **NOTE:** `yearlyEnergyDcKwh` here is the original value from the Solar API. When a panel is moved on the workbench (Page 2), the backend recomputes **monthly** values via flux sampling and stores them as `monthlyEnergyDcKwh` (12 values) in the project's `PanelEdit` record — not on the location's enriched JSON, which remains immutable.

### 5.2 dataLayers Endpoint

**Called:** Once per location (Page 1 pipeline, cache miss only). Uses the `FULL` quality parameter to retrieve all available layers.

**GeoTIFF files downloaded and stored:**

| Layer           | Format                                      | MVP Usage                                                         | Status      |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| **RGB**         | Single-band visual image                    | Converted to PNG/WebP → canvas background on Page 2               | **Active**  |
| **monthlyFlux** | 12-band GeoTIFF (one band per month)        | Sampled per-band for monthly kWh recomputation on Page 2          | **Active**  |
| **mask**        | Binary raster                               | Drag boundary constraint on Page 2                                | **Active**  |
| **annualFlux**  | Single-band raster (kWh/kW/year per pixel)  | Stored for future use (e.g. heatmap overlay, validation)          | Stored only |
| **DSM**         | Digital Surface Model (elevation per pixel) | Stored for future use (e.g. 3D roof visualisation, tilt analysis) | Stored only |

### 5.3 API Call Reference

Based on the validated PROTOTYPE (`solar_api.py` + `config.py`).

**Base URL:**

```
https://solar.googleapis.com/v1
```

**buildingInsights — find closest building:**

```
GET {BASE}/buildingInsights:findClosest?location.latitude={lat}&location.longitude={lng}&key={API_KEY}
```

**dataLayers — retrieve GeoTIFF layer URLs:**

```
GET {BASE}/dataLayers:get?location.latitude={lat}&location.longitude={lng}&radiusMeters={radius}&view=FULL_LAYERS&requiredQuality=HIGH&key={API_KEY}
```

| Parameter            | Value          | Notes                                                         |
| -------------------- | -------------- | ------------------------------------------------------------- |
| `location.latitude`  | float          | Confirmed building latitude                                   |
| `location.longitude` | float          | Confirmed building longitude                                  |
| `radiusMeters`       | int (e.g. 120) | Area radius around the building                               |
| `view`               | `FULL_LAYERS`  | Returns all layers including monthly flux and DSM             |
| `requiredQuality`    | `HIGH`         | Ensures high-resolution imagery; returns error if unavailable |
| `key`                | string         | Google Cloud API key with Solar API enabled                   |

**dataLayers response → GeoTIFF download mapping:**

The `dataLayers` response returns temporary signed URLs for each layer. These URLs **expire** and must be downloaded promptly during the pipeline.

| Response Field   | Download As        | Description                     |
| ---------------- | ------------------ | ------------------------------- |
| `dsmUrl`         | `dsm.tif`          | Digital Surface Model           |
| `rgbUrl`         | `rgb.tif`          | Satellite/aerial imagery        |
| `maskUrl`        | `mask.tif`         | Analysis boundary mask          |
| `annualFluxUrl`  | `annual_flux.tif`  | Annual solar flux (single band) |
| `monthlyFluxUrl` | `monthly_flux.tif` | Monthly solar flux (12 bands)   |

> **NOTE:** The response also contains `hourlyShadeUrls` (array of 24 URLs). These are **not downloaded** for the MVP.

---

## 6. Core Pipelines

### 6.1 Solar API Fetch Pipeline (Page 1, Backend)

**Trigger:** Cache miss on `POST /api/locations/resolve`

```
1. Call buildingInsights(lat, lng)
   → On failure: mark location "failed", stop
   → On success: enrich solarPanels[] with IDs, store JSON

2. Call dataLayers(lat, lng, radiusMeters)
   → On failure: mark location "failed", stop
   → On success: download GeoTIFFs (RGB, monthlyFlux, mask, annualFlux, DSM) to Supabase Storage

3. Convert RGB GeoTIFF → PNG/WebP (using sharp)

4. Mark location "ready"
```

### 6.2 Flux Sampling Pipeline (Page 2, Backend)

**Trigger:** Panel drag-end or rotate-end on workbench

```
1. Receive: panelId, new center (lat, lng), rotation
   Panel physical dimensions (m) read from cached buildingInsights; converted to pixels via geo-transform

2. Convert lat/lng → GeoTIFF pixel coordinates (proj4 + geo-transform)

3. Compute rotated panel footprint (4 corners in pixel space)

4. For each of the 12 monthly bands in monthlyFlux.tif:
   a. Iterate pixels within footprint bounding box
   b. Test point-in-polygon for each pixel centre
   c. Collect flux values for pixels inside the rotated rectangle
   d. Average flux values → monthlyFlux[band]
   e. monthlyEnergyDcKwh[band] = avgFlux × (panelCapacityWatts / 1000)

5. Return: monthlyEnergyDcKwh[12]
```

**Validated in PROTOTYPE:** `panel_flux_aggregator.py` + `debug_layout.py` achieve <1% error vs. Google's pre-computed values using this approach on annual flux. The same logic applies per monthly band.

### 6.3 NEM Billing Simulation (Page 3, Frontend)

**Trigger:** Page load and every user input change (What-If reactivity)

**Inputs:**

- `monthlyGeneration[m]` — sum of `monthlyEnergyDcKwh[m]` across kept panels
- `monthlyConsumption` — user input (single value, applied to all 12 months)
- `connectionPhase` — Single or Three-phase
- `tariffConfig` — rates, thresholds, EEI table (loaded from backend once)

**Per-month loop (m = 1 to 12):**

```
1. baselineBill = computeBill(consumption, tariffConfig, phase)

2. netImport = consumption - monthlyGeneration[m]
3. If netImport < 0:
     creditBalance += abs(netImport)
     billableKwh = 0
   Else:
     billableKwh = max(0, netImport - creditBalance)
     creditBalance = max(0, creditBalance - (netImport - billableKwh))

4. If month == December: creditBalance = 0  // forfeit

5. nemBill = computeBill(billableKwh, tariffConfig, phase)
6. savings[m] = baselineBill - nemBill
```

**Aggregation:**

- `annualSavings` = sum(savings)
- `paybackYears` = systemCost / annualSavings
- `roi10Year` = ((annualSavings × 10) - systemCost) / systemCost × 100
- `carbonOffsetKg` = totalYearlyEnergyDcKwh / 1000 × carbonOffsetFactorKgPerMwh

---

## 7. Coordinate Transform Reference

All GeoTIFF files embed geo-transform metadata. Two conversion directions are needed:

| Direction           | Used For                                                 | Implementation                                                             |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Lat/lng → pixel** | Positioning panels on the RGB canvas                     | `proj4` (EPSG:4326 → GeoTIFF CRS) + `rasterio.transform.rowcol` equivalent |
| **Pixel → lat/lng** | Converting dragged panel position back for flux sampling | Inverse of above                                                           |

Ported from PROTOTYPE modules: `layout_compiler.py` and `panel_flux_aggregator.py`.

---

## 8. Project Directory Structure

```
/solar-layout-generator
│
├── /docs                        # Agent guardrails and human-readable project docs
│   ├── TRD.md                   # System design, data flow, API contracts
│   ├── PLAN.md                  # Sprint plan and feature breakdown
│   ├── PROGRESS.md              # Running log of what is done vs. pending
│   └── PRD.md                   # Product requirements (mirrors FYP objectives)
│
├── /prisma
│   ├── schema.prisma            # Single source of truth for DB schema
│   ├── seed.ts                  # Seeds tariff config, EEI table
│   └── /migrations              # Version-controlled schema changes
│
├── /shared
│   ├── package.json             # Workspace package: { "name": "@shared/types" }
│   └── types.ts                 # Shared TypeScript types (API contracts, domain models)
│
├── /backend
│   ├── /src
│   │   ├── /config              # Env validation, constants (API keys, Supabase URL)
│   │   ├── /middleware           # Auth (Supabase JWT), error handler
│   │   ├── /routes              # Express route handlers
│   │   ├── /services            # Business logic (location resolver, flux sampler)
│   │   ├── /geo                 # Coordinate transforms, GeoTIFF processing, RGB conversion
│   │   ├── app.ts               # Express app setup and middleware
│   │   └── server.ts            # Server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── /frontend
│   ├── /src
│   │   ├── /api                 # Backend API call functions
│   │   ├── /components          # Reusable UI elements
│   │   ├── /hooks               # Custom React hooks
│   │   ├── /lib                 # Client-side billing engine and tariff simulation
│   │   ├── /pages
│   │   │   ├── MapPage.tsx
│   │   │   ├── WorkbenchPage.tsx
│   │   │   └── AnalysisPage.tsx
│   │   ├── App.tsx              # Root component with routing
│   │   └── main.tsx             # Vite entry point
│   ├── package.json
│   └── vite.config.ts
│
├── .github/
│   └── copilot-instructions.md  # VS Code Copilot agent instructions
│
├── .claude/
│   ├── CLAUDE.md                # Claude Code agent instructions (auto-read by CC)
│   ├── settings.json            # Project-scoped CC settings (model, permissions, MCP)
│   └── skills/                  # Custom skills
│
├── package.json                 # Root: defines npm workspaces
├── .env.example
├── .gitignore
└── README.md
```

**Conventions:**

- **Tests are colocated.** Unit tests live next to their source files (e.g. `billingEngine.test.ts` beside `billingEngine.ts`). No separate test directory.
- **Monorepo via npm workspaces.** Three workspace packages: `shared`, `backend`, `frontend`.
- **The `/docs` directory is a development-time artifact.** Excluded from deployment and FYP submission. Its purpose is to constrain agent scope and provide human-readable project context.
- **Agent instructions live in two locations.** `.claude/CLAUDE.md` (auto-read by Claude Code) and `.copilot/copilot-instructions.md` (auto-read by VS Code Copilot). Both point agents to `/docs` first.

---

## 9. Testing Strategy

| Scope                  | Tool                 | Coverage                                       |
| ---------------------- | -------------------- | ---------------------------------------------- |
| NEM billing simulation | Vitest               | Core billing logic with golden test cases      |
| Flux sampling math     | Vitest               | Point-in-polygon, average flux, kWh conversion |
| API endpoints          | Manual / Vitest      | Request validation, response shape             |
| UI components          | Out of scope for MVP | —                                              |
| E2E / integration      | Manual UAT           | Full workflow via deployed Heroku instance     |

---

## 10. Agent Workflow

This project is primarily built using AI coding agents (Claude Code, VS Code Copilot). The agent infrastructure is designed to keep agents scoped, informed, and productive.

### 10.1 Agent File Hierarchy

| File / Directory                   | Read By                | Purpose                                                                        |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `.claude/CLAUDE.md`                | Claude Code (auto)     | Project rules, coding standards, key constraints. Read on every session start. |
| `.claude/settings.json`            | Claude Code (auto)     | Model preference, allowed tools, permission prompts, MCP server config.        |
| `.claude/commands/*.md`            | Claude Code (slash)    | Reusable task recipes invoked via `/command-name`.                             |
| `.copilot/copilot-instructions.md` | VS Code Copilot (auto) | Equivalent of CLAUDE.md for Copilot-powered workflows.                         |
| `/docs/PRD.md`                     | Agents (on demand)     | What to build — product scope, user stories, acceptance criteria.              |
| `/docs/TRD.md`                     | Agents (on demand)     | How to build it — architecture, data models, pipelines, API contracts.         |
| `/docs/PLAN.md`                    | Agents (on demand)     | Sprint plan — ordered feature breakdown with status.                           |
| `/docs/PROGRESS.md`                | Agents (on demand)     | Running log — what is done, what is pending, blockers.                         |

### 10.2 Agent Operational Loop

The intended workflow for a Claude Code session:

```
1. Agent reads .claude/CLAUDE.md (automatic on session start)
2. Agent reads /docs/PLAN.md to identify the next undone task
3. Agent reads /docs/TRD.md for relevant architecture context
4. Agent implements the task (code changes, tests)
5. Agent runs tests / dev server to verify
6. Agent updates /docs/PROGRESS.md with what was done
7. Agent commits with a conventional commit message
```

Custom slash commands (`.claude/commands/`) encode common variations of this loop so the developer does not need to re-type instructions each session:

| Command              | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `/implement-feature` | Read PLAN.md, pick the next undone feature, implement it, run tests, update PROGRESS.md. |
| `/fix-error`         | Run the dev server, read the error output, diagnose, fix, verify the fix.                |
| `/update-progress`   | Check the git log since last update, refresh PROGRESS.md accordingly.                    |

### 10.3 Agent Rules (for CLAUDE.md)

The following rules should be included in `.claude/CLAUDE.md`:

- **Always read `/docs` before making changes.** Check `PLAN.md` for the current task and `TRD.md` for architecture decisions. Do not invent features not in the plan.
- **Refer to official documentation** for any library or API you are unsure about. Key references:
  - [Google Solar API](https://developers.google.com/maps/documentation/solar)
  - [Prisma](https://www.prisma.io/docs)
  - [Supabase](https://supabase.com/docs)
  - [Konva.js](https://konvajs.org/docs)
  - [geotiff.js](https://geotiffjs.github.io/geotiff.js)
- **Use context7 conservatively.** Prefer official docs first; use context7 MCP only when official docs are insufficient or you need to verify syntax for a specific version.
- **Do not guess API behaviour.** If unsure how an endpoint or library function works, look it up before writing code. Common pitfalls: `geotiff.js` band reading, `proj4` transform syntax, Supabase Storage signed URL generation.
- **PROTOTYPE reference.** The Python prototype (documented in `solar-layout-prototype.md`) contains validated implementations for: Solar API calls (`solar_api.py`), coordinate transforms (`layout_compiler.py`), flux sampling (`panel_flux_aggregator.py`), and GeoTIFF processing (`tif_to_png.py`). Port logic carefully — do not reinvent.
- **Commit messages.** Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- **Tests.** Colocated beside source files. Run `vitest` before committing any changes to `/lib` (billing engine) or `/geo` (flux sampling).

## 11. Location Cache Policy Decision (05/03/26)

This project uses a shared immutable cache model for `Location` records.

- A `Location` stores immutable Solar API output for a coordinate and is not user-private data.
- Multiple users/projects may intentionally reference the same `locationId` to avoid duplicate Solar API calls and reduce credit usage.
- `POST /api/projects` accepts an existing `locationId` from the shared cache by design.
- `POST /api/locations/resolve` accepts optional `projectId` for cache warm-up compatibility; when supplied, ownership checks are enforced before linking.
- `GET /api/locations/:id/status`, `GET /api/locations/:id/data`, and `POST /api/locations/:locationId/panels/recompute` require the caller to have at least one project linked to the location.
