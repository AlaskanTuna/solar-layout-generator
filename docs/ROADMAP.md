# DEVELOPMENT ROADMAP

## Solar Layout Generator — Implementation & Thesis Plan

> **Start Date:** 3 March 2026
> **Target Completion:** 1 June 2026 (3-day buffer before the 4 June hard deadline)
> **Total Duration:** ~13 weeks (91 calendar days)
> **Methodology:** RAD (Construction + Cutover phases), executed via agent workflows

---

## Development Strategy: Backend-First

The MVP is built **backend-first**. Every frontend page depends on API endpoints and cached data from the Solar API pipeline. Building the backend first achieves three things: it validates the riskiest technical work early (GeoTIFF processing, coordinate transforms, API caching), it establishes stable API contracts that the frontend can consume without rework, and it lets agent workflows operate against a testable backend before any UI exists.

The frontend is then built page-by-page on top of the working backend. The landing page is built during the integration phase since it is a static public page that does not block the core MVP workflow but is needed before UAT participants access the application.

---

## Timeline Overview

| Phase       | Dates            | Weeks | Focus                                                   |
| ----------- | ---------------- | ----- | ------------------------------------------------------- |
| **Phase 0** | 3 Mar -- 9 Mar   | 1     | Scaffolding and environment setup                       |
| **Phase 1** | 10 Mar -- 30 Mar | 3     | Backend: Auth, API endpoints, Solar API pipeline        |
| **Phase 2** | 31 Mar -- 20 Apr | 3     | Frontend: Auth UI, Dashboard, Page 1, Page 2            |
| **Phase 3** | 21 Apr -- 4 May  | 2     | Frontend: Billing engine, Page 3, PDF export            |
| **Phase 4** | 5 May -- 14 May  | 1.5   | Integration testing, landing page, deployment on Heroku |
| **Phase 5** | 15 May -- 18 May | 0.5   | Post-MVP enhancements and polish                        |
| **Phase 6** | 19 May -- 1 Jun  | 2     | UAT (deployed app) + thesis documentation (parallel)    |

> **Thesis writing starts during Phase 4** and runs in parallel through to submission. Each completed phase should be documented shortly after it ends.

---

## Phase 0: Scaffolding and Environment Setup

**Dates:** 3 Mar -- 9 Mar (Week 1)

**Goal:** A running monorepo with all tooling configured, ready for backend feature development.

### Tasks

- [x] Initialise Git repository and push to GitHub.
- [x] Set up npm workspaces monorepo (`/shared`, `/backend`, `/frontend`).
- [x] Configure TypeScript, ESLint, Prettier across all workspaces.
- [x] Scaffold backend with Express.js + TypeScript; verify `GET /api/health` returns `200 OK`.
- [x] Set up Prisma ORM; write `schema.prisma` with Location, Project, TariffConfig and User models.
- [x] Create Supabase project (PostgreSQL database, Auth, Storage bucket for GeoTIFFs).
- [x] Run first Prisma migration against Supabase PostgreSQL.
- [x] Scaffold frontend with Vite + React + React Router + Tailwind CSS (placeholder pages only).
- [x] Install shadcn/ui and lucide-react.
- [x] Create `.env.example` with all required keys (Google Solar API, Google Maps API, Supabase URL/keys).
- [x] Write `CLAUDE.md` and `.copilot/copilot-instructions.md` agent instruction files, both pointing to `/docs`.
- [x] Copy PRD, TRD and Knowledge Vault into `/docs` directory inside the repo.
- [x] Verify the dev server runs (`npm run dev` starts both frontend and backend concurrently).

### Exit Criteria

Backend responds to `GET /api/health`. Prisma client is generated and can query the database. Frontend renders a placeholder page. Agent instruction files are in place.

---

## Phase 1: Backend — Auth, API Endpoints, Solar API Pipeline

**Dates:** 10 Mar -- 30 Mar (Weeks 2--4)

**Goal:** All backend API endpoints are functional and testable. The Solar API fetch pipeline processes locations and stores cached data in Supabase.

### Week 2 (10 Mar -- 16 Mar): Auth Middleware + Project CRUD + Tariff Endpoints

- [x] Implement Supabase Auth JWT verification middleware for Express.
- [x] Implement project CRUD endpoints:
  - `POST /api/projects` (create project).
  - `GET /api/projects` (list user's projects).
  - `GET /api/projects/:id` (get project details).
  - `PATCH /api/projects/:id/layout` (save edited layout).
  - `PATCH /api/projects/:id/analysis` (save analysis config and results).
- [x] Implement Zod request validation schemas for all endpoints.
- [x] Seed tariff configuration data (`prisma db seed`) with post-July 2025 RP4 tariff rates and EEI table from the Knowledge Vault.
- [x] Implement `GET /api/tariff/config` endpoint.
- [x] Test all endpoints manually with a REST client (Postman, Thunder Client or similar).

### Week 3 (17 Mar -- 23 Mar): Solar API Fetch Pipeline

- [x] Implement `POST /api/locations/resolve` endpoint.
- [x] Build cache-check logic (coordinate tolerance matching against existing Location records).
- [x] On cache miss: call `buildingInsights` endpoint, enrich `solarPanels[]` with deterministic panel IDs, store enriched JSON in Location record.
- [x] On cache miss: call `dataLayers` endpoint, download GeoTIFFs (RGB, monthlyFlux, mask, annualFlux, DSM) to Supabase Storage.
- [x] Convert RGB GeoTIFF to PNG/WebP using `sharp`; store the derived image URL on the Location record.
- [x] Mark location status transitions: `processing` -> `ready` or `failed`.
- [x] Implement `GET /api/locations/:id/status` endpoint (for frontend polling).
- [x] Implement `GET /api/locations/:id/data` endpoint (returns enriched buildingInsights JSON + RGB image URL).
- [x] Handle error cases: Solar API failure, no building found, low imagery quality, network timeout.
- [x] Test the full pipeline with at least 3 different Malaysian addresses; record confirmed working locations for later testing.

### Week 4 (24 Mar -- 30 Mar): Flux Recomputation Endpoint + Unit Tests

- [x] Implement `POST /api/locations/:locationId/panels/recompute` endpoint.
  - [x] Read `monthlyFlux.tif` (12 bands) from Supabase Storage using `geotiff.js`.
  - [x] Implement coordinate transforms (`proj4`): lat/lng to GeoTIFF pixel coordinates and back.
  - [x] Compute rotated panel footprint (4 corners in pixel space).
  - [x] Implement point-in-polygon flux sampling across the rotated rectangle for each of the 12 monthly bands.
  - [x] Return `monthlyEnergyDcKwh[12]` array.
- [x] Cross-validate recomputed values against the Python prototype output (target: less than 1% error).
- [x] Write unit tests for flux sampling math (`fluxSampler.test.ts`): point-in-polygon, average flux, kWh conversion.
- [x] Write unit tests for coordinate transform utilities.

### Exit Criteria

All API endpoints are functional and return correct responses. The Solar API fetch pipeline successfully processes locations and stores cached data. Flux recomputation returns accurate monthly kWh values validated against the prototype. Unit tests pass.

---

## Phase 2: Frontend — Auth UI, Dashboard, Page 1, Page 2

**Dates:** 31 Mar -- 20 Apr (Weeks 5--7)

**Goal:** The user-facing frontend for authentication, project management and the first two MVP pages is complete, consuming the backend APIs built in Phase 1.

### Week 5 (31 Mar -- 6 Apr): Auth UI + Dashboard + Page 1

- [x] Build Sign Up and Sign In pages using Supabase Auth client SDK.
- [x] Implement protected route wrapper: unauthenticated users redirect to sign-in.
- [x] Set up TanStack Query for data fetching and caching.
- [x] Build Dashboard page:
  - [x] List the user's projects (from `GET /api/projects`).
  - [x] "Create New Project" button and flow (project name input, calls `POST /api/projects`, navigates to Page 1).
- [x] Build Page 1 (MapPage):
  - [x] Integrate `@googlemaps/js-api-loader` and Google Maps Autocomplete.
  - [x] Render an interactive map; centre on search result.
  - [x] "Is this your building?" confirmation dialog; lock confirmed lat/lng to the project.
  - [x] On confirmation, call `POST /api/locations/resolve`.
  - [x] Implement loading state with polling (`GET /api/locations/:id/status`).
  - [x] On `ready`: navigate to Page 2. On `failed`: show error message, allow retry.

### Week 6 (7 Apr -- 13 Apr): Page 2 — Canvas Rendering + Basic Interactions

- [x] Set up Konva.js + react-konva on WorkbenchPage.
- [x] Load cached RGB image as canvas background from `GET /api/locations/:id/data`.
- [x] Implement coordinate transform utilities on the frontend (lat/lng to canvas pixel position).
- [x] Render solar panels as interactive Konva rectangles, positioned from enriched `solarPanels[]`.
- [x] Implement panel quantity slider (min 4, max `maxArrayPanelsCount`); panels ordered by yield descending.
- [x] Implement panel deletion (select + delete).
- [x] Display the current total estimated annual yield based on active panels.

### Week 7 (14 Apr -- 20 Apr): Page 2 — Drag, Rotate, Flux Recomputation

- [x] Implement panel drag (constrained within the mask boundary).
- [x] Implement panel rotation (0--360 degrees).
- [x] Implement overlap prevention: reject drag/rotate if bounding box intersects another panel; snap back to previous position.
- [x] Wire drag-end and rotate-end events to call `POST /api/locations/:locationId/panels/recompute`.
- [x] Update the displayed total yield in real time after recomputation response.
- [x] Implement "Save and Continue" button: persist `editedLayout` (array of PanelEdit objects) via `PATCH /api/projects/:id/layout`.
- [x] Navigate to Page 3 on save.

### Exit Criteria

A user can sign up, sign in, create a project, search a location, confirm the building, wait for pipeline completion and land on Page 2. On the workbench, panels render correctly on the RGB background. Users can adjust panel count, delete, drag and rotate panels. Moved/rotated panels trigger flux recomputation and the yield display updates. The edited layout saves to the database and the user proceeds to Page 3.

---

## Phase 3: Frontend — Billing Engine, Page 3, PDF Export

**Dates:** 21 Apr -- 4 May (Weeks 8--9)

**Goal:** The analysis page with NEM billing simulation, financial projections and PDF export is complete. The full MVP workflow is functional end-to-end.

### Week 8 (21 Apr -- 27 Apr): Billing Engine + Analysis Page Core

- [ ] Implement the client-side NEM billing engine in `/frontend/src/lib/billingEngine.ts`:
  - [ ] Baseline bill calculation (energy + capacity + network charges, tiered by 1500 kWh threshold).
  - [ ] NEM bill calculation with 1:1 kWh offset and credit carry-forward logic.
  - [ ] Retail charge, AFA, SST, RE Fund (KWTBB), EEI rebate calculations.
  - [ ] 12-month loop producing per-month savings, credit balance and bill breakdown.
- [ ] Write unit tests for the billing engine with golden test cases from the Knowledge Vault (`billingEngine.test.ts`).
- [ ] Build the AnalysisPage UI shell: load tariff config from backend, load project's `editedLayout`.
- [ ] Aggregate `monthlyEnergyDcKwh` across kept panels to derive `monthlyGeneration[m]`.
- [ ] Implement user-editable assumptions panel (monthly consumption, connection phase, panel wattage override, system cost, AFA rate toggle).
- [ ] Wire assumption changes to re-run the billing engine reactively.

### Week 9 (28 Apr -- 4 May): Results Display + PDF Export

- [ ] Build hero metrics display: monthly savings (RM and %), annual savings, payback period, 10-year net benefit.
- [ ] Build comparison charts using Recharts: monthly bill with vs. without solar; cumulative savings over time.
- [ ] Build month-by-month breakdown table.
- [ ] Build detailed bill breakdown section (energy, capacity, network, retail, AFA, EEI, RE Fund, SST).
- [ ] Add threshold crossing warnings (600/1000/1500 kWh boundaries).
- [ ] Implement installation cost estimation (`systemKwp x RM 4,500/kWp`, user-editable) and payback/ROI/carbon offset calculations.
- [ ] Implement client-side PDF export using html2pdf.js (or jsPDF + html2canvas):
  - [ ] PDF includes: layout thumbnail, system summary, financial highlights, month-by-month breakdown, assumptions, disclaimers.
- [ ] Add disclaimer text on all user-facing results.
- [ ] Save analysis config and results via `PATCH /api/projects/:id/analysis`.

### Exit Criteria

The billing engine passes all unit tests. The analysis page displays correct financial projections that update reactively. PDF export produces a complete, readable report. The entire MVP workflow (sign up through PDF export) is functional.

---

## Phase 4: Integration Testing, Landing Page, Deployment

**Dates:** 5 May -- 14 May (Weeks 10--10.5)

**Goal:** The application is fully integrated, has a public landing page and is deployed on Heroku with a working URL. This must be completed before UAT begins.

### Tasks

- [ ] Build a public landing page:
  - [ ] Product description, workflow overview, key features.
  - [ ] Limitations and disclaimers.
  - [ ] Call-to-action to sign up.
  - [ ] Responsive for desktop and mobile.
- [ ] Run end-to-end integration tests: complete the full workflow at least 5 times with different Malaysian addresses.
- [ ] Validate financial calculations against manual calculations using the Knowledge Vault's reference data.
- [ ] Fix integration bugs discovered during testing.
- [ ] Test on mobile browsers for responsive behaviour (NFR-1).
- [ ] Configure Heroku deployment:
  - [ ] Create Heroku app; connect GitHub repo for auto-deploy.
  - [ ] Set environment variables via `heroku config:set` (API keys, Supabase credentials).
  - [ ] Verify `heroku-postbuild` builds frontend and backend correctly.
  - [ ] Confirm `Procfile` starts the Express server.
- [ ] Deploy and verify the public URL works end-to-end.
- [ ] Write `README.md` with installation instructions, environment variable reference and usage guide.
- [ ] Begin recruiting UAT participants (minimum 3 from target user groups).
- [ ] **Begin thesis writing:** start drafting Chapter 5 (System Design and Implementation) with architecture diagrams and screenshots of the deployed system.

### Exit Criteria

The application is live on Heroku with a public URL. The full workflow is validated against multiple test locations. The landing page is presentable. UAT participants are confirmed. Chapter 5 drafting is underway.

---

## Phase 5: Post-MVP Enhancements and Polish

**Dates:** 15 May -- 18 May (4 days, strictly timeboxed)

**Goal:** Quick UX improvements and edge case handling before UAT participants access the application. Only ship items that are completable within 1 day each.

### Candidate Enhancements (pick 2--3 based on available time)

- [ ] Roof segment visual grouping: overlay `roofSegmentStats[]` boundaries on the workbench canvas.
- [ ] Panel interaction UX: visual feedback on hover, selection highlight, undo last action.
- [ ] Annual flux heatmap overlay on the workbench (using stored `annualFlux.tif`).
- [ ] Dashboard improvements: project status badges, last-modified timestamps, project deletion with confirmation.
- [ ] Error handling polish: user-friendly error messages, retry mechanisms, network failure recovery.
- [ ] Responsive design refinements for tablet and mobile viewports.
- [ ] Tooltips and guided steps for non-technical users (NFR-2).
- [ ] Loading skeleton states and micro-interactions.

### Exit Criteria

At least 2 enhancements are shipped and deployed. The application feels polished enough for UAT participants. No new features are started after 18 May.

---

## Phase 6: UAT + Thesis Documentation (Parallel)

**Dates:** 19 May -- 1 Jun (Weeks 12--13)

**Goal:** Collect structured user feedback from at least 3 target users. Complete the FYP thesis document in parallel.

> **Writing approach:** Follow the conventions in `turnitin-detection-avoidance.txt` throughout all thesis chapters. Vary sentence structures, limit transitions, use direct language and avoid mechanical patterns.

### UAT Track

#### Week 12 (19 May -- 25 May): UAT Round 1

- [ ] Prepare UAT materials: test scenarios, task list, feedback form (Google Forms or similar).
- [ ] Distribute the deployed public URL and UAT guide to participants (minimum 3).
- [ ] Participants complete the full workflow independently on the live Heroku deployment.
- [ ] Collect Round 1 feedback (usability, accuracy, comprehensibility of results).
- [ ] Triage feedback: categorise as critical bug, usability fix or future enhancement.
- [ ] Fix critical bugs and deploy fixes.

#### Week 13 (26 May -- 1 Jun): UAT Round 2 + Final Fixes

- [ ] Conduct Round 2 with the same or additional participants.
- [ ] Collect Round 2 feedback to confirm issues are resolved.
- [ ] Compile UAT findings into a summary (response rates, satisfaction scores, key issues, resolution status).

### Thesis Track

The Part 2 chapters extend the existing Part 1 Investigation Report (Chapters 1--4):

**Chapter 5: System Design and Implementation**

- [ ] System architecture overview (reference TRD; include architecture diagram).
- [ ] Technology stack justification (brief; connect to Chapter 2 literature review).
- [ ] Database design (ER diagram from Prisma schema).
- [ ] UI/UX design decisions (wireframes/screenshots from each page).
- [ ] Implementation of each MVP module (Page 1, Page 2, Page 3) with code excerpts and screenshots.
- [ ] Agent workflow methodology description (how AI coding agents were used during development).
- [ ] Key technical challenges and solutions (GeoTIFF processing, coordinate transforms, billing engine).

**Chapter 6: Testing and Evaluation**

- [ ] Unit testing results (billing engine, flux sampling).
- [ ] Integration testing approach and results.
- [ ] UAT methodology, participant profiles and task design.
- [ ] UAT findings: quantitative results (task completion rates, satisfaction) and qualitative feedback.
- [ ] Comparison with existing tools/methods (reference Chapter 2's similar systems).
- [ ] Evaluation against project objectives (Objectives 1, 2 and 3 from Chapter 1.4).

**Chapter 7: Conclusion and Recommendations**

- [ ] Summary of achievements.
- [ ] Evaluation of RAD methodology effectiveness.
- [ ] Limitations (API constraints, tariff assumptions, imagery quality variations).
- [ ] Recommendations for future work.
- [ ] Reflection on SDG 7 alignment.

### Documentation Timeline

| Period                     | Documentation Task                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------- |
| 5 May -- 14 May (Phase 4)  | Draft Chapter 5 sections as features are integrated (architecture, screenshots)       |
| 15 May -- 18 May (Phase 5) | Continue Chapter 5; outline Chapter 7                                                 |
| 19 May -- 25 May           | Draft Chapter 6 testing sections; incorporate Round 1 UAT data                        |
| 26 May -- 29 May           | Complete Chapter 6 with Round 2 data; finalise Chapter 5; write Chapter 7             |
| 30 May -- 1 Jun            | Compile full thesis, cross-reference all chapters, final proofreading, Turnitin check |

### Exit Criteria (1 June 2026)

At least 3 UAT participants have completed testing. Feedback is documented and critical issues resolved. Complete thesis (Chapters 1--7) is formatted in APA 7th, Turnitin-checked and ready for submission. The 3-day buffer (2--4 June) is reserved for any last-minute corrections only.

---

## Risk Mitigation

| Risk                                                         | Impact                             | Mitigation                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Google Solar API returns low-quality data for test locations | Page 2 workbench unusable          | Test with multiple Malaysian addresses early in Phase 1 Week 3. Maintain a list of confirmed working locations for UAT.                    |
| Konva.js canvas performance with many panels                 | Sluggish UX on Page 2              | Limit max rendered panels; use canvas layer optimisation. Profile early in Phase 2 Week 6.                                                 |
| Billing engine logic errors                                  | Incorrect financial projections    | Write unit tests with golden test cases from the Knowledge Vault before building the UI (Phase 3 Week 8).                                  |
| GeoTIFF coordinate transform errors                          | Panels rendered at wrong positions | Port logic carefully from the validated Python prototype. Cross-validate in Phase 1 Week 4.                                                |
| UAT participant recruitment difficulty                       | Fewer than 3 participants          | Begin recruitment during Phase 4 (early May). Prepare backup participants from classmates or faculty.                                      |
| Scope creep during post-MVP                                  | Delays UAT or thesis writing       | Phase 5 is strictly 4 days. Only ship enhancements completable within 1 day each.                                                          |
| Thesis writing falls behind                                  | Missed deadline                    | Start drafting Chapter 5 during Phase 4. Never leave all writing to the final week. The 3-day buffer is for corrections only, not writing. |
| Heroku deployment issues                                     | UAT blocked                        | Attempt first deployment at the start of Phase 4, not the end. Allows time to debug hosting configuration.                                 |

---

## Agent Workflow Notes

This roadmap is designed to be consumed by both the developer and AI coding agents (Claude Code, GitHub Copilot):

1. **Always point agents to `/docs` first.** `CLAUDE.md` and `.copilot/copilot-instructions.md` should instruct agents to read PRD.md and TRD.md before making code changes.
2. **Use this roadmap as the sprint backlog.** Each phase's task list maps to implementable work items. Agents can pick up tasks by referencing the checkbox items.
3. **Update `PROGRESS.md` after each session.** Track completed tasks, blockers and deviations from the plan.
4. **Reference the Knowledge Vault** (`mvp-page-3-knowledge-vault.md`) when implementing the billing engine. It has validated tariff rates, NEM rules and test case data.
5. **Reference the Prototype** (`solar-layout-prototype.md`) when implementing GeoTIFF processing and coordinate transforms. Port the validated Python logic; do not reinvent it.
6. **Keep `/docs/PLAN.md`** in the repo in sync with this roadmap as changes occur.
7. **Backend-first discipline:** do not start a frontend page until its corresponding backend endpoints are tested and stable.
