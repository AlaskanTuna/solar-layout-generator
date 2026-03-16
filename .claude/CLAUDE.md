# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read `docs/ROLES.md` first** — it defines your role, responsibilities, and boundaries within the multi-agent workflow for this project.

## Project

Solar Layout Generator — a full-stack SaaS web app for Malaysian homeowners to assess rooftop solar potential using Google Solar API data. Built as a Final Year Project (FYP) using RAD methodology over 13 weeks (3 Mar – 1 Jun 2026).

## Architecture

Monorepo with npm workspaces: `/shared`, `/backend`, `/frontend`.

```
Frontend (React + Vite + Konva.js)  ↔  REST API  ↔  Backend (Express.js + Prisma)  ↔  Supabase (PostgreSQL + Auth + Storage)  ↔  Google Solar API + Google Maps API
```

**Three-page MVP workflow:** MapPage (location search → Solar API call) → WorkbenchPage (Konva.js canvas for panel drag/rotate/delete) → AnalysisPage (NEM billing simulation → PDF export).

**Core constraint:** Google Solar API is called once per location and cached in Supabase. Panel edits on the workbench require zero additional Solar API calls; only flux recomputation (GeoTIFF sampling) hits the backend.

**Development strategy:** Backend-first. Backend endpoints and pipeline must work before frontend pages are built on top.

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, lucide-react, React Router, TanStack Query, Konva.js + react-konva, html2pdf.js
- **Backend:** Express.js, TypeScript, Prisma ORM, Supabase (PostgreSQL/Auth/Storage), Zod, geotiff.js, sharp, proj4
- **Testing:** Vitest (colocated test files, e.g. `billingEngine.test.ts` beside `billingEngine.ts`)
- **Shared types:** `/shared/types.ts` consumed by both backend and frontend

## Skills (`.claude/skills/`)

Pre-distilled reference implementations ported from the validated Python prototype. **Read the relevant skill before implementing** — this avoids re-reading the entire `docs/PROTOTYPE.md`.

| Skill                           | Use When                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `geotiff-coordinate-transforms` | Converting lat/lng ↔ GeoTIFF pixels, panel rotation math, dimension conversion              |
| `flux-sampling`                 | Point-in-polygon, area-average flux, monthly kWh computation for moved panels               |
| `solar-api-pipeline`            | buildingInsights + dataLayers API calls, GeoTIFF download, panel enrichment, RGB conversion |
| `project-scaffolding`           | Bootstrapping a new project from zero — research, docs, and repo scaffold via 3 gated phases |

## Commands

```bash
npm run format          # Prettier across the entire repo
npm run dev             # Start both frontend and backend concurrently (once scaffolded)
npx prisma migrate dev  # Run Prisma migrations (from /backend or root)
npx vitest              # Run tests (from workspace with tests)
```

## Code Style

Enforced by Prettier (`.prettierrc`): single quotes, no semicolons, no trailing commas, 120 char line width, 2-space indent.

## Git Commit Convention

All commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) with these constraints:

- **Format:** `<type>[optional scope]: <description>`
- **No body or footer** — the description line is the entire commit message.
- **Single sentence**, imperative mood, no trailing period.
- **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

**Examples:**

```
feat(auth): add JWT refresh token endpoint
fix(billing): correct NEM tier threshold calculation
refactor(canvas): extract panel drag handler into hook
docs: update API contract for Solar data endpoint
```

### Agent Reminder Rule

After completing any **major implementation or significant change** (i.e., something worth a standalone Git commit), the agent **must** suggest a ready-to-use commit message to the user in this format:

> **Suggested commit:** `feat(scope): brief description of what was done`

Do **not** suggest a commit for minor tweaks, formatting-only changes, or doc-only updates unless explicitly asked.

## Agent Workflow & Documentation Protocol

1. Write or find `/docs/PLAN.md` for the next task before implementing anything.
2. Reference `/docs/TRD.md` for architecture decisions, API contracts, data models, and pipeline details.
3. Reference `/docs/PRD.md` for product requirements and acceptance criteria.
4. Reference `/docs/ROADMAP.md` for the development phase timeline only.
5. After completing work, update `/docs/PROGRESS.md` with a dated summary.
6. If tests were run, record results in `/docs/TEST.md`.
7. Tick completed items (`- [x]`) in `/docs/PLAN.md`.

## Documentation Format

### 1. PROGRESS.md

```markdown
## [DD/MM/YY] - Implemented Task Name

- Brief description of change.
```

### 2. PLAN.md

```markdown
## TODO Tasks

### n. Refinement/Testing/Bug/Feature: Task Name

**Purpose/Issue:** The description in brief.

**Implementation:**

- [x] Task 1
- [ ] Task 2
```

### 3. TEST.md

```markdown
## [DD/MM/YY] - Test Plan Name

- Scenario: Brief description of the test scenario.
- Steps: Brief steps taken during testing.
- Result: Brief result summary (Pass/Fail).
```

## Key Data Models

- **Location** (immutable): cached Solar API response per coordinate (buildingInsightsJson, GeoTIFF paths, RGB image URL)
- **Project** (mutable): user's solar project linked to a Location, contains editedLayout (array of PanelEdit objects) and analysisResults
- **TariffConfig** (seeded): Malaysian NEM tariff rates and thresholds

## Environment Variables

Required keys (see `.env.example` once created): `GOOGLE_SOLAR_API_KEY`, `GOOGLE_MAPS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
