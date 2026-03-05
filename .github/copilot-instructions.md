# Agent Development Standards

> **Read `docs/ROLES.md` first** — it defines your role, responsibilities, and boundaries within the multi-agent workflow for this project.

## Project Context

Solar Layout Generator — a full-stack SaaS web app for Malaysian homeowners to assess rooftop solar potential using Google Solar API data. Built as a Final Year Project (FYP) using RAD methodology over 13 weeks (3 Mar – 1 Jun 2026).

Monorepo with npm workspaces: `/shared`, `/backend`, `/frontend`.

```
Frontend (React + Vite + Konva.js)  ↔  REST API  ↔  Backend (Express.js + Prisma)  ↔  Supabase (PostgreSQL + Auth + Storage)  ↔  Google Solar API + Google Maps API
```

**Three-page MVP workflow:** MapPage (location search → Solar API call) → WorkbenchPage (Konva.js canvas for panel drag/rotate/delete) → AnalysisPage (NEM billing simulation → PDF export).

**Development strategy:** Backend-first. Backend endpoints and pipeline must work before frontend pages are built on top.

## Technology Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, lucide-react, React Router, TanStack Query, Konva.js + react-konva, html2pdf.js
- **Backend:** Express.js, TypeScript, Prisma ORM, Supabase (PostgreSQL/Auth/Storage), Zod, geotiff.js, sharp, proj4
- **Testing:** Vitest (colocated test files, e.g. `billingEngine.test.ts` beside `billingEngine.ts`)
- **Shared types:** `/shared/types.ts` consumed by both backend and frontend

## Project Constraints

1. Google Solar API is called once per location and cached in Supabase. Panel edits on the workbench require zero additional Solar API calls; only flux recomputation (GeoTIFF sampling) hits the backend.
2. Required env keys (see `.env.example` once created): `GOOGLE_SOLAR_API_KEY`, `GOOGLE_MAPS_API_KEY`, `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL`.
3. Key data models: **Location** (immutable, cached Solar API response), **Project** (mutable, user's solar project with editedLayout and analysisResults), **TariffConfig** (seeded Malaysian NEM tariff rates).

## Code Style & Patterns

1. Enforced by Prettier (`.prettierrc`): single quotes, no semicolons, no trailing commas, 120 char line width, 2-space indent.
2. **Git Commit Convention** — all commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
   - **Format:** `<type>[optional scope]: <description>`
   - **No body or footer** — description line is the entire message.
   - **Single sentence**, imperative mood, no trailing period.
   - **Allowed types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
   - **Examples:**
     ```
     feat(auth): add JWT refresh token endpoint
     fix(billing): correct NEM tier threshold calculation
     refactor(canvas): extract panel drag handler into hook
     docs: update API contract for Solar data endpoint
     ```
3. **Agent Reminder Rule** — after completing any **major implementation or significant change** (i.e., something worth a standalone Git commit), the agent **must** suggest a ready-to-use commit message to the user in this format:

   > **Suggested commit:** `feat(scope): brief description of what was done`

   Do **not** suggest a commit for minor tweaks, formatting-only changes, or doc-only updates unless explicitly asked.

4. Common commands:
   - `npm run format` — Prettier across the entire repo
   - `npm run dev` — Start both frontend and backend concurrently
   - `npx prisma migrate dev` — Run Prisma migrations
   - `npx vitest` — Run tests

## Documentation Protocol

The agent MUST maintain the `docs/` directory (with "AGENT ONLY" specified) to ensure the project state is always transparent and synchronized.

### 1. PROGRESS.md (State Awareness)

- To let agents/users always be aware of the state of development briefly.
- Update this file after every development iteration according to `PLAN.md`'s TODOs.
- **Example:**

  ```markdown
  ## [DD/MM/YY] - Implemented Task Name

  - Brief description of change.
  ```

### 2. PLAN.md (Task Management)

- To let agents know exactly what to do next at any time briefly.
- Always plan before implementing a feature/task/bug fix.
- Tick the checkbox (`- [x]`) immediately upon completion.
- If a change of course occurs, modify existing tasks or add new ones immediately.
- **Example:**

  ```markdown
  ## TODO Tasks

  ### n. Refinement/Testing/Bug/Feature: Task Name

  **Purpose/Issue:** The description in brief.

  **Implementation:**

  - [x] Task 1
  - [ ] Task 2
  ```

### 3. TEST.md (Validation Records)

- To communicate testing intent and results for reference briefly.
- Only write to/update this file if a test is being run.
- Describe the scenario being tested, the steps taken, and the results (Pass/Fail).
- **Example:**

  ```markdown
  ## [DD/MM/YY] - Test Plan Name

  - Scenario: Brief description of the test scenario.
  - Steps: Brief steps taken during testing.
  - Result: Brief result summary (Pass/Fail).
  ```
