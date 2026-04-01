# PLAN (AGENT ONLY)

> Refer to `docs/TRD.md` for architecture, data models, API contracts, and code-level details.
> Refer to `docs/PRD.md` for product requirements and acceptance criteria.
> Refer to `docs/ROADMAP.md` for the phase timeline overview.

---

<!-- Record latest from here onwards. -->

## Phase 0: Project Scaffolding

### 1. Root Configuration

- [x] Update `package.json` with workspaces, name, version, private, dev script
- [x] Create `tsconfig.json` (base TypeScript config)
- [x] Create `.eslintrc.cjs` (root ESLint config)
- [x] Create `.env.example` (all required env vars)

### 2. Shared Workspace (`/shared`)

- [x] `shared/package.json`
- [x] `shared/tsconfig.json`
- [x] `shared/index.ts` â€” shared types (PanelEdit, LocationStatus, ProjectStatus, API types)

### 3. Backend Workspace (`/backend`)

- [x] `backend/package.json`
- [x] `backend/tsconfig.json`
- [x] `backend/src/server.ts` â€” entry point
- [x] `backend/src/app.ts` â€” Express app with CORS, JSON, routes
- [x] `backend/src/routes/health.ts` â€” GET /api/health
- [x] `backend/src/routes/locations.ts` â€” placeholder stubs
- [x] `backend/src/routes/projects.ts` â€” placeholder stubs
- [x] `backend/src/routes/tariff.ts` â€” placeholder stubs
- [x] `backend/src/config/env.ts` â€” env validation with Zod
- [x] `backend/src/middleware/errorHandler.ts` â€” global error handler

### 4. Prisma Schema (`/prisma`)

- [x] `prisma/schema.prisma` â€” Location, Project, TariffConfig models

### 5. Frontend Workspace (`/frontend`)

- [x] `frontend/package.json`
- [x] `frontend/tsconfig.json`
- [x] `frontend/vite.config.ts` â€” React plugin, alias, dev proxy
- [x] `frontend/tailwind.config.js`
- [x] `frontend/postcss.config.js`
- [x] `frontend/index.html`
- [x] `frontend/src/main.tsx` â€” React root with Router + QueryClient
- [x] `frontend/src/App.tsx` â€” all routes
- [x] `frontend/src/index.css` â€” Tailwind directives
- [x] `frontend/src/lib/utils.ts` â€” cn() utility
- [x] `frontend/components.json` â€” shadcn/ui config
- [x] Placeholder pages (Landing, SignIn, SignUp, Dashboard, Map, Workbench, Analysis)

### 6. Documentation

- [x] Update PLAN.md
- [x] Update PROGRESS.md

---

## Phase 1: Backend â€” Auth, API Endpoints, Solar API Pipeline

### 1. Feature: Supabase Client Singleton + Auth Middleware

**Purpose:** All subsequent endpoints need authenticated `userId`.

**Implementation:**

- [x] Create Supabase admin client using `createClient()` with `SUPABASE_PROJECT_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [x] Create auth middleware: extract `Authorization: Bearer <token>`, call `supabase.auth.getUser(token)`, attach `req.user`
- [x] Create Express type augmentation for `req.user`
- [x] Return 401 on missing/invalid token
- [x] Apply per-route group, not globally (health stays public)

### 2. Feature: Zod Validation Schemas

**Purpose:** Request validation for all endpoints.

**Implementation:**

- [x] `resolveLocationSchema`: lat, lng, projectId (optional)
- [x] `fluxRecomputeSchema`: panelId, center, rotation
- [x] `createProjectSchema`: name, locationId
- [x] `saveLayoutSchema`: editedLayout (PanelEdit[])
- [x] `saveAnalysisSchema`: analysisConfig, analysisResults
- [x] Reusable `validate()` middleware wrapper

### 3. Feature: Project CRUD Endpoints

**Purpose:** 5 endpoints per TRD Â§4.4.

**Implementation:**

- [x] `POST /api/projects` â€” create with name, locationId, userId from auth
- [x] `GET /api/projects` â€” list where userId matches
- [x] `GET /api/projects/:id` â€” get single with ownership check
- [x] `PATCH /api/projects/:id/layout` â€” save editedLayout, set status layout_saved
- [x] `PATCH /api/projects/:id/analysis` â€” save config + results, set status analysis_saved

### 4. Feature: Tariff Seed Script + Endpoint

**Purpose:** Seed RP4 tariff data, serve via API.

**Implementation:**

- [x] Seed TariffConfig with RP4 data (rates, thresholds, 16-bracket EEI table, afaRateDefault)
- [x] `GET /api/tariff/config` â€” return TariffConfigResponse (public, no auth)
- [x] Added tariffVersion unique constraint + migration

### 5. Feature: Solar API Fetch Pipeline

**Purpose:** Core pipeline â€” calls Google Solar API, downloads GeoTIFFs, stores everything.

**Implementation:**

- [x] `fetchBuildingInsights(lat, lng)` â€” buildingInsights:findClosest
- [x] `fetchDataLayers(lat, lng, radius)` â€” dataLayers:get with FULL_LAYERS
- [x] Radius from bounding box: haversine(SW, NE) / 2 + 10
- [x] Panel enrichment: deterministic IDs (panel_0, panel_1, ...)
- [x] GeoTIFF download + Supabase Storage upload (5 layers)
- [x] RGB GeoTIFF â†’ PNG conversion with sharp
- [x] Pipeline orchestration: processing â†’ ready/failed

### 6. Feature: Location Endpoints

**Purpose:** 3 location endpoints + recompute.

**Implementation:**

- [x] `POST /api/locations/resolve` â€” cache check, create/link, async pipeline
- [x] `GET /api/locations/:id/status` â€” return status
- [x] `GET /api/locations/:id/data` â€” return buildingInsights + signed RGB URL

### 7. Feature: Coordinate Transform Utilities

**Purpose:** Shared geo utilities ported from Python prototype.

**Implementation:**

- [x] `setupGeoTransform(tiffImage)` â€” extract CRS, origin, resolution
- [x] `latLngToPixel(lat, lng, geo)` â€” WGS84 â†’ CRS â†’ pixel
- [x] `pixelToLatLng(px, py, geo)` â€” inverse
- [x] `metersToPixels(meters, geo)` â€” using pixel resolution
- [x] `getRotatedCorners(cx, cy, wPx, hPx, rotRad)` â€” 4 corners

### 8. Feature: Flux Sampling Service

**Purpose:** Point-in-polygon flux sampling for panel recomputation.

**Implementation:**

- [x] `pointInPolygon(x, y, polygon)` â€” ray-casting with pixel center offset
- [x] `calculateAverageFlux(corners, fluxData, width, height)` â€” bounding box + PIP
- [x] `computeMonthlyEnergy(image, corners, panelCapacityWatts)` â€” 12 bands

### 9. Feature: Flux Recomputation Endpoint

**Purpose:** Wire transforms + flux sampler into HTTP endpoint.

**Implementation:**

- [x] `POST /api/locations/:locationId/panels/recompute` â€” auth, validate, sample, return monthlyEnergyDcKwh

### 10. Testing: Geo + Flux Unit Tests

**Implementation:**

- [x] `pointInPolygon` â€” inside, outside, rotated polygon
- [x] `calculateAverageFlux` â€” uniform, non-uniform, clipping, empty
- [x] `latLngToPixel` / `pixelToLatLng` â€” roundtrip accuracy
- [x] `metersToPixels` â€” known resolution
- [x] `getRotatedCorners` â€” 0Â°, 90Â°, 45Â° rotations
- [x] `rotatePoint` â€” 0Â°, 90Â°, 180Â°
- [x] All 18 tests passing

---

## Phase 1.1: Backend Hardening (Post-QA Audit)

### 1. Decision Gate: Location Cache Policy (M1 + M2)

**Purpose/Issue:** QA flagged ambiguity between ownership enforcement and the shared immutable Location cache model.

**Implementation:**

- [x] Confirm architecture decision with ZJ: `Location` remains shared immutable cache across users (per TRD caching model)
- [x] Document decision explicitly in `docs/TRD.md` (cross-user project-location linking behavior and rationale)
- [x] Document API contract expectation for `POST /api/projects` with existing `locationId`
- [x] Decide `POST /api/locations/resolve` requirement for `projectId` (required vs optional) to prevent orphan credit usage

### 2. Hardening: Resolve Endpoint Ownership/Orphan Control

**Purpose/Issue:** Remove unaudited orphan-location behavior and align endpoint behavior to the decision above.

**Implementation:**

- [x] If `projectId` is required: N/A â€” decision was optional (see TRD Â§11)
- [x] If `projectId` stays optional: add explicit orphan-handling policy (retention/cleanup) and enforce it in service logic
- [x] Add/adjust request validation and error responses to match the chosen contract â€” validator already has `projectId: z.string().uuid().optional()`, route handles both paths correctly, frontend resolve call omits projectId for new projects

### 3. Hardening: Async Error Handling for Routes (L1)

**Purpose/Issue:** Ensure all async route failures reach global `errorHandler`.

**Implementation:**

- [x] Add reusable `asyncHandler` wrapper (or equivalent)
- [x] Wrap async handlers in `locations.ts`, `projects.ts`, and `tariff.ts`
- [x] Verify thrown errors return structured HTTP error responses (no hanging requests)

### 4. Hardening: Recompute `panelId` Contract Consistency (L2)

**Purpose/Issue:** `panelId` is validated in request but not used in runtime behavior.

**Implementation:**

- [x] Decide contract direction: remove `panelId` from request schema OR include it in endpoint response for correlation
- [x] Update validators, route handler, and shared types to match the chosen contract
- [x] Update smoke tests/examples to match updated payload shape

### 5. Hardening: Expand Authz Smoke Coverage (L3)

**Purpose/Issue:** Current smoke tests miss project cross-link vector through `POST /api/projects`.

**Implementation:**

- [x] Add smoke case: User A attempts `POST /api/projects` using User B `locationId`
- [x] Assert expected status based on Decision Gate policy (shared cache policy vs user-scoped policy)
- [x] Keep cleanup and failure output behavior intact

### 6. Hardening: Runtime Guards for `buildingInsightsJson` (I1)

**Purpose/Issue:** Current recompute path uses unsafe casts for `solarPotential` numeric fields.

**Implementation:**

- [x] Add runtime parsing/guards for `panelWidthMeters`, `panelHeightMeters`, `panelCapacityWatts`
- [x] Return controlled error response on invalid/missing fields instead of runtime crash
- [x] Add focused unit tests for invalid shape handling

### 7. QA Re-run Exit Checklist

**Purpose/Issue:** Validate hardening pass before frontend Phase 2 dependency.

**Implementation:**

- [x] Run backend unit tests (`vitest`)
- [x] Run `tests/smoke/smoke-authz.sh` with updated assertions
- [x] Update `docs/TEST.md` with hardening test results
- [x] Request QA re-review on hardening diff only

---

## Phase 2: Frontend - Auth UI, Dashboard, MapPage, WorkbenchPage

### 1. Feature: Frontend Environment + Supabase Auth Client

**Purpose/Issue:** Auth client singleton and env config â€” required by all frontend features.

**Implementation:**

- [x] Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` to root `.env` (reuse existing Supabase/Google values)
- [x] Update root `.env.example` to document the new `VITE_` variables
- [x] Add `envDir: path.resolve(__dirname, '..')` to `frontend/vite.config.ts` so Vite reads the root `.env`
- [x] Create `frontend/src/lib/supabase.ts` â€” `createClient()` singleton
- [x] Install `@supabase/supabase-js` in frontend workspace

### 2. Feature: Auth Context + Protected Route

**Purpose/Issue:** Session management and route guarding for authenticated pages.

**Implementation:**

- [x] Create `frontend/src/hooks/useAuth.tsx` â€” AuthContext providing `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`
- [x] On mount: `getSession()` + subscribe to `onAuthStateChange`
- [x] Create `frontend/src/components/ProtectedRoute.tsx` â€” spinner if loading, redirect to `/sign-in` if no session
- [x] Update `App.tsx`: wrap `/dashboard` and `/project/:projectId/*` with `<ProtectedRoute>`

### 3. Feature: API Client Layer

**Purpose/Issue:** Typed fetch wrappers for all backend endpoints with auth header injection.

**Implementation:**

- [x] Create `frontend/src/api/client.ts` â€” `apiFetch()` with `Authorization: Bearer <token>`, `/api` prefix, Vite proxy
- [x] Create `frontend/src/api/locations.ts` â€” `resolveLocation`, `getLocationStatus`, `getLocationData`, `recomputeFlux`
- [x] Create `frontend/src/api/projects.ts` â€” `createProject`, `listProjects`, `getProject`, `saveLayout`, `saveAnalysis`
- [x] Create `frontend/src/api/tariff.ts` â€” `getTariffConfig`
- [x] All functions typed against `@shared/types`

### 4. Feature: Install shadcn/ui Components

**Purpose/Issue:** UI primitives needed across pages.

**Implementation:**

- [x] Run `npx shadcn@latest add button input label card dialog separator badge slider toast sonner`

### 5. Feature: Sign In + Sign Up Pages

**Purpose/Issue:** Auth UI using Supabase client SDK.

**Implementation:**

- [x] `SignInPage`: email + password form, calls `signIn()`, navigates to `/dashboard` on success
- [x] `SignUpPage`: email + password form, calls `signUp()`, shows "Check your email" confirmation
- [x] Both pages: inline error display; redirect to `/dashboard` if already authenticated

### 6. Feature: Landing Page

**Purpose/Issue:** Public entry point with CTA.

**Implementation:**

- [x] Hero section: app name, one-liner, CTA button â†’ `/sign-in`
- [x] Redirect to `/dashboard` if already authenticated

### 7. Feature: Dashboard Page

**Purpose/Issue:** Project list + create new project flow.

**Implementation:**

- [x] TanStack Query: fetch project list via `listProjects()`
- [x] Render project cards: name, status badge, created date; click â†’ navigate by status (`draft` â†’ map, `layout_saved` â†’ workbench, `analysis_saved` â†’ analysis)
- [x] "New Project" dialog: name input â†’ store name in state â†’ navigate to `/project/new/map`
- [x] Empty state + sign out button in header

### 8. Feature: MapPage - Google Maps + Location Resolve

**Purpose/Issue:** User searches building, triggers Solar API pipeline, creates project.

**Implementation:**

- [x] Install `@types/google.maps` (dev) in frontend workspace
- [x] Create `frontend/src/hooks/useGoogleMaps.ts` â€” JS API Loader with `places` and `maps` libraries
- [x] Map centered on Malaysia; Autocomplete search box; place marker on selection
- [x] "Confirm Location" â†’ `POST /api/locations/resolve`; poll `GET /api/locations/:id/status` every 2s on `processing`
- [x] On `ready`: `POST /api/projects` with name + locationId â†’ navigate to `/project/:id/workbench`
- [x] On `failed`: error message + retry option
- [x] If `projectId !== "new"`: skip project creation, load existing location

### 9. Feature: WorkbenchPage - Canvas Setup + Panel Rendering

**Purpose/Issue:** Konva.js canvas with satellite background and panels from buildingInsights.

**Implementation:**

- [x] Create `frontend/src/hooks/useWorkbenchData.ts` â€” fetches project â†’ locationId â†’ `getLocationData()` â†’ returns `{ buildingInsights, rgbImageUrl, project }`
- [x] Create `frontend/src/lib/canvasTransforms.ts` â€” `latLngToPixel` / `pixelToLatLng` using `buildingInsights.boundingBox` + image dimensions
- [x] Create `frontend/src/components/workbench/PanelLayer.tsx` â€” renders panels as Konva `Rect`, color-coded by energy yield
- [x] Panel dimensions: `panelWidthMeters`/`panelHeightMeters` â†’ pixels via bounding box meters-per-pixel ratio
- [x] Panel rotation offset: 90Â° for PORTRAIT, 0Â° for LANDSCAPE
- [x] shadcn Slider: min=4, max=`maxArrayPanelsCount`; show/hide panels highest-yield-first; display count in toolbar

### 10. Feature: WorkbenchPage - Panel Interactions

**Purpose/Issue:** Drag, rotate, delete panels with flux recomputation.

**Implementation:**

- [x] Create `frontend/src/hooks/usePanelState.ts` â€” manages `PanelEdit[]`; methods: `movePanel`, `rotatePanel`, `deletePanel`, `updatePanelEnergy`
- [x] Create `frontend/src/components/workbench/PanelRect.tsx` â€” `draggable` Konva Rect; on `dragend` â†’ convert pixel â†’ lat/lng â†’ fire recompute â†’ update energy
- [x] Rotation: input/handle â†’ debounced (300ms) recompute
- [x] Delete: click panel â†’ delete button â†’ status `'deleted'`, hidden from canvas
- [x] Overlap detection: AABB check after drag; snap back on overlap
- [x] Toolbar: real-time total annual yield (kWh), panel count, COâ‚‚ offset

### 11. Feature: WorkbenchPage - Save & Navigate

**Purpose/Issue:** Persist edited layout and proceed to AnalysisPage.

**Implementation:**

- [x] "Save & Continue" â†’ `PATCH /api/projects/:id/layout` with `{ editedLayout: PanelEdit[] }`
- [x] Navigate to `/project/:id/analysis` on success; disable button while saving
- [x] "Back to Dashboard" link

---

## Phase 2.1: Frontend QA Fixes

### 1. Refinement: MapPage Search + New Project Recovery

**Purpose/Issue:** QA follow-up and manual testing showed the Page 1 search input was not visible in practice, and the new-project flow could lose its name/context on refresh before project creation.

**Implementation:**

- [x] Replace the imperatively injected Google Maps control input with a React-rendered overlay search field so Autocomplete remains visible and testable
- [x] Persist the new project draft name in `sessionStorage` when leaving the dashboard for `/project/new/map`
- [x] Persist pending `locationId` + processing state so a refresh during rooftop analysis can resume instead of losing the project context
- [x] Clear the persisted draft after successful project creation and reset it on retry

### 2. Refinement: Workbench Interaction Polish

**Purpose/Issue:** QA flagged invalid panel drags not snapping back visually, and rotation input could briefly display raw out-of-range values before normalization.

**Implementation:**

- [x] Reset the Konva node position immediately when a drag placement is rejected so overlap/bounds rejection visually snaps back
- [x] Reuse the same reset path when recompute rollback restores the previous panel center
- [x] Normalize the rotation input's displayed value on change so typed values stay within `0-359`

### 3. Testing: Frontend Utility + Hook Coverage

**Purpose/Issue:** Phase 3 should not start with zero frontend regression coverage on the non-trivial parsing, transform, and panel-state logic introduced in Phase 2.

**Implementation:**

- [x] Add Vitest frontend test setup scoped to `frontend/src`
- [x] Add utility tests for `buildingInsights.ts`
- [x] Add utility tests for `canvasTransforms.ts`
- [x] Add hook tests for `usePanelState.ts`

---

## Phase 2.2: Manual QA Follow-up

### 1. Refinement: MapPage Polling + Places Modernization

**Purpose/Issue:** Manual QA exposed a new-project polling deadlock (`GET /api/locations/:id/status` returned 404 before a `Project` existed), while Google Maps flagged the legacy Places Autocomplete path as deprecated for new customers.

**Implementation:**

- [x] Allow `GET /api/locations/:id/status` to return status for orphan `Location` records during the new-project analysis window, while keeping `GET /api/locations/:id/data` tied to owned projects
- [x] Add a backend regression test for the orphan-status ownership filter so the Phase 2 new-project flow stays covered
- [x] Update `MapPage` to load the newer `PlaceAutocompleteElement` via `google.maps.importLibrary('places')` when available, with legacy autocomplete retained only as a compatibility fallback
- [x] Fail the processing state cleanly when polling errors occur instead of leaving the UI stuck on "Analyzing your rooftop..."
- [x] Guard ready-state project creation so repeated polling responses cannot create duplicate projects before navigation completes

---

## Phase 2.3: Manual QA Follow-up - Workbench + Observability

### 1. Refinement: Workbench Bootstrap Deadlock + Runtime Logging

**Purpose/Issue:** Manual QA found that Page 2 could remain stuck on "Preparing the workbench..." even after the project and location were created successfully. Debugging was also slowed by minimal frontend/backend runtime logging across auth, project, location, and pipeline steps.

**Implementation:**

- [x] Remove the Workbench render deadlock where `panelDimensions` was required before the canvas container could mount and report stage size
- [x] Keep the top-level Workbench loading gate focused on actual data prerequisites (`project`, parsed `buildingInsights`, rooftop image) and move canvas sizing/loading to the in-page canvas area
- [x] Add explicit runtime errors for incomplete Workbench data such as a missing linked `locationId` or missing signed rooftop image URL
- [x] Add frontend dev-console logging for API requests and Workbench bootstrap state so manual QA can see which prerequisite is still pending
- [x] Add backend request/route/pipeline logging for auth, project CRUD, location resolve/status/data, recompute, and pipeline file uploads
- [x] Harden `GET /api/locations/:id/data` so a `ready` location cannot return a partial 200 response without `buildingInsightsJson` or `rgbImageUrl`

---

## Phase 2.4: Workbench Rendering Alignment

### 1. Refinement: Prototype-Accurate Panel Rendering

**Purpose/Issue:** Manual QA found that Page 2 rendered the initial Solar API panel layout at the wrong scale and mirrored/spread across the rooftop image. The validated prototype (`layout_compiler.py`) uses the full reference GeoTIFF transform from `rgb.tif`, while the current frontend was approximating placement from `buildingInsights.boundingBox`.

**Implementation:**

- [x] Expose reference image geo-transform metadata from `GET /api/locations/:id/data` using the stored `rgb.tif` (fallback `dsm.tif`) instead of relying on the building bounding box alone
- [x] Update frontend Workbench coordinate conversion to use the reference GeoTIFF transform plus display scaling, matching the prototype's lat/lng → projected CRS → pixel workflow
- [x] Normalize positive GeoTIFF Y resolutions to top-down image coordinates so both frontend rendering and backend recompute use the correct row direction
- [x] Add/update focused transform tests for the new frontend projected-CRS path and the backend GeoTIFF Y-resolution normalization
- [x] Verify with a live numeric sanity check that the latest location's panel centers now cluster within the actual rooftop image bounds instead of spanning the whole image

---

## Phase 2.5: Location Cache Smoke Test

### 1. Testing: End-to-End Cache Reuse Verification

**Purpose/Issue:** Manual QA and future regressions need a repeatable way to prove that `POST /api/locations/resolve` warms the shared immutable cache on the first run, persists the expected location artifacts to Supabase, and reuses the same `Location` on a second run instead of triggering duplicate cache rows.

**Implementation:**

- [x] Add a dedicated smoke script under `tests/smoke/` that authenticates a temporary Supabase user, resolves a test coordinate, polls until the location is `ready`, and verifies the cached `Location` row contains the expected persisted artifacts
- [x] Extend the script to mirror the real new-project flow by creating a project after the first ready location, then repeating the resolve + create-project flow again with the same coordinates
- [x] Assert the second resolve reuses the same `locationId`, returns `ready` immediately, and does not increase the number of `Location` rows within the configured coordinate tolerance window
- [x] Support both cold-cache validation (fresh coordinate required) and warm-cache validation (`CACHE_ALLOW_WARM=1`) so the script is usable during manual troubleshooting without always burning a fresh Solar API call
- [x] Syntax-check the script and document usage/verification notes for the manual live run

---

## Phase 3: Frontend - Billing Engine, Page 3, PDF Export

### 1. Feature: Batch Recompute Endpoint

**Purpose/Issue:** The current single-panel recompute endpoint downloads the full `monthly_flux.tif` from Supabase Storage on every call. To populate `monthlyEnergyDcKwh` for all active panels accurately (not just moved ones), a batch endpoint is needed that loads the GeoTIFF once and processes N panels in a single request.

**Implementation:**

- [x] Add `POST /api/locations/:locationId/panels/recompute-batch` endpoint accepting `{ panels: [{ panelId, center, rotation }, ...] }`
- [x] Download and parse `monthly_flux.tif` once per request; reuse the image object and geo-transform across all panels
- [x] Loop through panels: `latLngToPixel` → `getRotatedCorners` → `computeMonthlyEnergy` per panel
- [x] Return `{ results: [{ panelId, monthlyEnergyDcKwh }, ...] }`
- [x] Add Zod validation schema for the batch request body
- [x] Keep existing single-panel `/recompute` endpoint unchanged (still used for interactive drag/rotate feedback)

### 2. Feature: Workbench Batch Recompute on Save

**Purpose/Issue:** After Phase 2, only dragged/rotated panels have `monthlyEnergyDcKwh` populated. All active panels need accurate monthly energy data derived from the actual `monthly_flux.tif` before the layout is saved and consumed by the AnalysisPage.

**Implementation:**

- [x] On "Save & Continue", collect all active (non-deleted) panels into a batch recompute request
- [x] Call the new batch endpoint with all active panels' current center and rotation
- [x] Update each panel's `monthlyEnergyDcKwh` in state with the batch response before serializing and saving the layout
- [x] Show a progress indicator during the batch recompute (may take 8–15s for large rooftops)
- [x] Handle partial failures: if batch recompute fails, block save and show a retry option

### 3. Refinement: Workbench Roof Mask Boundary

**Purpose/Issue:** Phase 2 Workbench constrains panels to the RGB image bounds and overlap checks, but not the true roof mask boundary. Panels can currently be placed outside the valid rooftop area.

**Implementation:**

- [x] Expose or derive usable roof/mask boundary data for the frontend so Workbench placement validation can reject panels dragged outside the valid rooftop area
- [x] Apply mask check alongside the existing image-bounds and overlap checks on drag-end

### 4. Refinement: React Error Boundary

**Purpose/Issue:** QA Phase 2 follow-up #6 — no top-level error boundary exists. If `AuthProvider` or any root-level query throws, users see a white screen with no recovery path.

**Implementation:**

- [x] Add a React error boundary component wrapping the app in `App.tsx` or `main.tsx`
- [x] Display a user-friendly fallback UI with a "Return to Dashboard" or "Reload" action

### 5. Feature: Expand TariffConfig with Analysis Defaults

**Purpose/Issue:** The billing engine needs several analysis-level defaults (NEM capacity caps, default system cost, default annual yield) that should be adjustable via the seed script or Supabase dashboard — not hardcoded in frontend source code.

**Implementation:**

- [x] Add a `defaults` JSON field to the `TariffConfig` model (or extend the existing `rates` JSON) containing: `nemCapSinglePhaseKw` (5), `nemCapThreePhaseKw` (12.5), `systemCostPerKwp` (4500), `annualYieldPerKwp` (1200)
- [x] Update `seed.ts` with the new defaults and re-seed
- [x] Update `TariffConfigResponse` in `shared/index.ts` to include the `defaults` field with a typed shape
- [x] Update `GET /api/tariff/config` to return the new field
- [x] Update frontend `getTariffConfig()` client — no logic change, just type alignment

### 6. Feature: NEM Billing Engine

**Purpose/Issue:** Core client-side billing simulation per TRD §6.3. All parameters sourced from `TariffConfig` at runtime — zero hardcoded rates.

**Implementation:**

- [x] Create `frontend/src/lib/billingEngine.ts` with typed tariff config interfaces (`TariffRates`, `TariffThresholds`, `EeiEntry`, `TariffDefaults`)
- [x] Implement `computeBill(consumptionKwh, config)` — the 10-step baseline bill: energy (threshold-based), capacity, network, retail, AFA, EEI rebate, RE Fund, SST, minimum charge
- [x] Implement `lookupEeiRebate(consumptionKwh, eeiTable)` — bracket lookup returning sen/kWh rebate rate
- [x] Implement `computeNemMonth(consumption, generation, creditBalance, config)` — net import, credit offset, billable kWh, credit carry-forward, and savings calculation
- [x] Implement `runAnnualSimulation(monthlyConsumption, monthlyGeneration[], config)` — 12-month loop with credit state, December forfeiture, and annual aggregation
- [x] All RM amounts in ringgit (not sen); convert sen rates internally

### 7. Testing: Billing Engine Unit Tests

**Purpose/Issue:** The Knowledge Vault provides 10 golden test cases (T1–T10) with expected RM values. These must pass before AnalysisPage is built.

**Implementation:**

- [x] Create `frontend/src/lib/billingEngine.test.ts`
- [x] Test `computeBill` against golden cases: zero usage, 300 kWh, 500 kWh, 600/601 kWh boundary, 800 kWh, 1500/1501 kWh cliff, 1600 kWh
- [x] Test `lookupEeiRebate` for each bracket boundary and above-cutoff case
- [x] Test `computeNemMonth` for net-positive, net-negative, credit-exhaustion, and December forfeiture scenarios
- [x] Test `runAnnualSimulation` for December credit forfeiture, credit carry-forward, and full-year savings aggregation
- [x] 43 tests passing; golden cases match Knowledge Vault to ≤ RM0.01 (1-cent differences documented as KV manual rounding errors)

### 8. Feature: AnalysisPage — Data Loading + User Inputs

**Purpose/Issue:** Page 3 shell — loads project, tariff config, and edited layout; provides user-editable assumption inputs that reactively re-run the billing engine.

**Implementation:**

- [x] Load project (with `editedLayout`) via `getProject()` on mount; redirect to workbench if status is still `draft`
- [x] Load tariff config via `getTariffConfig()` on mount (TanStack Query, cached)
- [x] Load location data via `getLocationData()` for `panelCapacityWatts` and `carbonOffsetFactorKgPerMwh`
- [x] Aggregate `monthlyEnergyDcKwh` across all active (non-deleted) panels → `monthlyGeneration[12]`
- [x] Compute system capacity: `activePanelCount × panelCapacityWatts / 1000` → `systemKwp`
- [x] User-editable inputs panel: monthly consumption (kWh, default 600), connection phase (single/three, default single), system cost (RM, default `systemKwp × systemCostPerKwp` from config), AFA rate (sen/kWh, default from config)
- [x] Re-run `runAnnualSimulation` reactively on any input change (useMemo or useEffect)

### 9. Feature: AnalysisPage — Results Display

**Purpose/Issue:** Present billing simulation results with hero metrics, comparison charts, and detailed breakdown.

**Implementation:**

- [x] Hero metrics row: monthly average savings (RM and %), annual savings, simple payback period (years), 10-year net benefit, CO₂ offset (kg/year)
- [x] Install Recharts (`npm install recharts --workspace=frontend`)
- [x] Comparison bar chart: monthly bill without solar vs. with solar (12 months)
- [x] Cumulative savings line chart: running total over 12 months
- [x] Month-by-month breakdown table (expandable): consumption, generation, net import, credit used, credit balance, baseline bill, NEM bill, savings
- [x] Bill component breakdown section: energy, capacity, network, retail, AFA, EEI, RE Fund, SST for a selected month
- [x] Threshold crossing warnings: flag when NEM consumption crosses 600/1500 kWh boundaries
- [x] Disclaimer text on all financial figures

### 10. Feature: PDF Export

**Purpose/Issue:** Client-side PDF report generation for the user to download and share.

**Implementation:**

- [x] Install `html2pdf.js` (`npm install html2pdf.js --workspace=frontend`)
- [x] Create a print-optimized report layout component (hidden or rendered off-screen) containing: system summary (kWp, panel count, location), financial highlights (annual savings, payback, ROI), month-by-month breakdown table, comparison chart snapshot, assumptions used, disclaimer
- [x] "Export PDF" button triggers `html2pdf()` on the report element with A4 page size
- [x] File name: `Solar_Analysis_{projectName}_{date}.pdf`

### 11. Feature: Save Analysis + Navigation

**Purpose/Issue:** Persist the analysis configuration and computed results to the backend so the project status advances to `analysis_saved` and results are viewable on return.

**Implementation:**

- [x] "Save Analysis" button → `PATCH /api/projects/:id/analysis` with `{ analysisConfig, analysisResults }`
- [x] `analysisConfig`: monthly consumption, connection phase, system cost, AFA rate, system kWp
- [x] `analysisResults`: monthly breakdown array, annual totals, payback, ROI, CO₂ offset
- [x] On save success: show confirmation toast; update project status badge
- [x] On revisit (status `analysis_saved`): load saved config into inputs, re-derive results reactively
- [x] "Back to Workbench" link for layout adjustments

---

## Phase 3.1: QA Audit Fixes

### 1. Hardening: Project Save Response Consistency

**Purpose/Issue:** `saveLayout` / `saveAnalysis` currently return a bare `Project`, which can drop the cached `location` relation needed by the AnalysisPage report/PDF after mutation.

**Implementation:**

- [x] Update backend project save services to include `location` in the mutation response
- [x] Verify frontend cached project data still has the location payload after `Save Analysis`

### 2. Hardening: Save Analysis Validation Shape

**Purpose/Issue:** Backend save-analysis validation is too unstructured for the actual payload the frontend sends.

**Implementation:**

- [x] Add a partial but typed Zod schema for `analysisConfig`
- [x] Add a partial but typed Zod schema for `analysisResults`
- [x] Keep the validator flexible enough for future additive fields

### 3. Hardening: Tariff Defaults Fallback Visibility

**Purpose/Issue:** The tariff route silently falls back to inline defaults when the DB field is null.

**Implementation:**

- [x] Emit an explicit warning when the tariff defaults fallback path is used
- [x] Keep the endpoint response shape unchanged for backward compatibility

### 4. Refinement: Analysis Threshold Warning Accuracy

**Purpose/Issue:** Threshold warning text currently assumes the retail/AFA/SST thresholds always match.

**Implementation:**

- [x] Split threshold warnings so retail, AFA, SST, and energy-cliff messaging stays accurate if config diverges
- [x] Add/update focused tests for the warning builder

### 5. Refinement: Workbench Save Ordering Cleanup

**Purpose/Issue:** The batch-save path updates local panel energy state even though navigation happens immediately after persistence.

**Implementation:**

- [x] Remove the redundant state update during save if the persisted payload already carries the recomputed values

### 6. Refinement: Analysis Results Presentation

**Purpose/Issue:** The month table labels `billableKwh` as net import, and the NEM breakdown panel omits several bill components.

**Implementation:**

- [x] Correct the month table to display true net import
- [x] Expand the "With Solar" breakdown to include retail, AFA, EEI rebate, and RE Fund line items

### 7. Refinement: AFA Input Guidance

**Purpose/Issue:** The AFA input currently accepts any numeric value without clarifying that negative values are valid rebates.

**Implementation:**

- [x] Constrain the input to a reasonable range without banning negative rebate values
- [x] Add helper text clarifying that negative AFA represents a rebate

---

## Phase 3.2: Database Reconciliation

### 1. Hardening: TariffConfig Migration Ledger + Seed Workflow

**Purpose/Issue:** The live Supabase database had the `TariffConfig.defaults` column and `tariffVersion` unique index, but the committed Prisma migration history was incomplete/out of sync. The normal `npm run db:seed` flow was also failing in this checkout because the `tsx`/`esbuild` runner was using the wrong platform binary.

**Implementation:**

- [x] Add a committed Prisma migration for `TariffConfig.defaults`
- [x] Reconcile the live database migration ledger so Prisma records the already-existing `tariffVersion` unique-index migration as applied
- [x] Update Prisma seed execution to run with Node directly instead of `tsx`, avoiding the copied-`node_modules` esbuild platform mismatch
- [x] Verify `npm run db:seed` succeeds against Supabase
- [x] Verify `prisma migrate status` reports the Supabase schema is up to date

---

## Phase 4: Integration Testing, Landing Page, Deployment

### 1. Feature: Product Landing Page — Design + Implementation

**Purpose/Issue:** The current landing page is a minimal placeholder (centered heading + two CTA buttons). Phase 4 requires a proper product landing page with workflow overview, key features, limitations/disclaimers, and responsive design. This is the public-facing first impression before UAT.

**Design flow:** Ideation → Stitch MCP (design proposal) → UI/UX Pro Max (implementation guidance) + 21st Dev (frontend components) + Nano Banana 2 (image components, optional).

**Implementation:**

- [x] Ideate landing page sections and content hierarchy (hero, workflow overview, features, limitations/disclaimers, CTA)
- [x] Generate design proposal via Stitch MCP and iterate until approved
- [x] Implement hero section: app name, tagline, primary CTA (Sign Up / Get Started), background visual (solar/rooftop themed)
- [x] Implement "How It Works" workflow section: 3-step visual (Search → Adjust → Analyse) with icons/illustrations
- [x] Implement key features section: highlight satellite data, interactive workbench, NEM billing simulation, PDF export
- [x] Implement limitations and disclaimers section: preliminary estimates only, on-site assessment recommended, Malaysian market only, API data limitations
- [x] Implement footer: project attribution (FYP), SDG 7 alignment note
- [x] Ensure responsive layout: desktop (primary) and mobile (secondary) per NFR-1
- [x] Verify authenticated users still auto-redirect to dashboard

### 2. Feature: Heroku Deployment

**Purpose/Issue:** Deploy the full application on Heroku Eco ($5/mo) using GitHub Student credits. The `Procfile`, `heroku-postbuild`, and production static-file serving are already configured from Phase 0.

**Implementation:**

- [x] Install Heroku CLI and authenticate (`heroku login`)
- [x] Create Heroku app (`heroku create solar-layout-generator` or similar available name)
- [x] Set all environment variables via `heroku config:set`: `NODE_ENV`, `GOOGLE_SOLAR_API_KEY`, `GOOGLE_MAPS_API_KEY`, `SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`
- [x] Configure Heroku stack and Node.js version if needed
- [x] Push to Heroku (`git push heroku main`) and verify build succeeds
- [x] Verify the public URL loads the landing page, sign-up/sign-in work, and the full MVP workflow completes end-to-end
- [x] Configure Google Maps API key restrictions to allow the Heroku domain
- [x] Configure Supabase Auth redirect URLs to include the Heroku domain
- [x] If Heroku deployment fails or is incompatible: fall back to Google Cloud Run deployment

### 3. Testing: End-to-End Integration Testing

**Purpose/Issue:** Validate the full MVP workflow (sign up → location search → workbench → analysis → PDF export) against multiple Malaysian addresses on the deployed application. Manual testing — Playwright E2E is not feasible due to Page 2's Konva.js canvas interactions.

**Implementation:**

- [x] Define 5 test locations: mix of residential buildings across different Malaysian states/cities with varying roof sizes
- [ ] For each test location, complete the full workflow manually on the deployed app:
  - [x] Sign in → Create project → Search address → Confirm building
  - [x] Wait for pipeline completion → Verify workbench renders panels correctly on RGB background
  - [x] Adjust panel count, drag at least one panel, rotate at least one panel → Verify yield updates
  - [x] Save layout → Verify analysis page loads with correct generation data
  - [x] Adjust consumption and connection phase → Verify billing recalculates
  - [ ] Export PDF → Verify PDF contains all required sections
  - [x] Save analysis → Verify dashboard shows `analysis_saved` status
- [x] Validate financial calculations against manual calculations using Knowledge Vault reference data for at least 2 locations
- [x] Document test results in `docs/TEST.md` (location, outcome, issues found)
- [x] Fix critical integration bugs discovered during testing

### 4. Testing: Mobile Responsive Behaviour

**Purpose/Issue:** NFR-1 requires the app to work on mobile browsers as a secondary target. Validate responsive behaviour before UAT participants access the app.

**Implementation:**

- [ ] Test landing page on mobile viewport (Chrome DevTools or real device)
- [ ] Test sign-in/sign-up flow on mobile
- [ ] Test dashboard on mobile (project list, new project dialog)
- [ ] Test MapPage on mobile (map interaction, address search, confirm dialog)
- [ ] Test WorkbenchPage on mobile (canvas rendering — note: touch interactions may be limited for MVP)
- [ ] Test AnalysisPage on mobile (inputs panel, charts, tables, PDF export)
- [ ] Document mobile-specific issues; fix critical layout breaks

### 5. Documentation: Update README.md

**Purpose/Issue:** The current README has basic info but lacks setup instructions for contributors, deployment reference, and usage guide.

**Implementation:**

- [ ] Add project description and screenshots/GIFs of the 3-page workflow
- [x] Add complete local development setup instructions (prerequisites, env vars, install, migrate, seed, run)
- [x] Add deployment section (Heroku setup steps, env var reference)
- [x] Add tech stack summary with version requirements
- [x] Add project structure overview (monorepo layout)
- [x] Add testing instructions (unit tests, smoke tests)
- [x] Add license and attribution section

### 6. Task: Begin UAT Participant Recruitment

**Purpose/Issue:** Minimum 3 participants needed from target user groups before Phase 6.

**Implementation:**

- [x] Identify and contact potential UAT participants (Malaysian homeowners, solar-interested individuals, classmates/faculty as backup)
- [x] Prepare brief UAT introduction explaining the app and what participants will test

---

## Phase 4.1: Knowledge Vault Corrections

### 1. Fix: Billing Engine Accuracy Corrections

**Purpose/Issue:** Cross-referencing the billing engine against MVP-PAGE-3-KNOWLEDGE-VAULT.md revealed several accuracy gaps: stale AFA default rate, incorrect SST calculation base (applies to full bill instead of >600 kWh portion only), missing degradation rate in financial projections, and missing 5-sen final rounding.

**Implementation:**

- [x] Update AFA default rate in seed.ts from -2.77 to -2.15 sen/kWh (March 2026 rate)
- [x] Fix SST proration: apply 8% only to the portion of the bill attributable to consumption >600 kWh, not the full subtotal
- [x] Add panel degradation rate to financial projections in analysis.ts (0.5%/year default for N-type panels)
- [x] Update payback calculation to account for annual degradation
- [x] Update 10-year ROI calculation to account for annual degradation
- [x] Add 5-sen final rounding to bill total
- [x] Update billing engine tests for corrected SST and rounding behaviour
- [x] Run `npx tsc --noEmit` and `npx vitest` to verify

### 2. Feature: Multi-Panel Model Selection (WorkbenchPage)

**Purpose/Issue:** Google Solar API assumes outdated 250W / 1.65×0.99m panels. Malaysian installers use 420-440W / 1.72-1.76×1.134m panels. Users need to select real panel models so dimensions, capacity, and cost are accurate.

**Implementation:**

- [x] Define `PanelModel` type in `shared/index.ts`: name, manufacturer, widthM, heightM, capacityWp, efficiency, costPerWp (RM)
- [x] Create `shared/panelModels.ts` with 5 seeded models from the knowledge vault (Google Solar API default + Jinko Tiger Neo + LONGi Hi-MO 6 + JA Solar DeepBlue 4.0 + Trina Vertex S+)
- [x] Add panel model selector dropdown on WorkbenchPage sidebar (above panel quantity slider)
- [x] Pass selected model's `costPerWp` to AnalysisPage to compute accurate system cost
- [x] Store selected panel model ID in project's editedLayout or analysisConfig
- [x] Run `npx tsc --noEmit` and `npx vitest` to verify

---

## Phase 4.2: Panel Model Dimension Integration

### 1. Feature: Panel Model List Fixes + Resize Konva Rectangles on Model Change

**Purpose/Issue:** Three issues with the current panel model implementation: (a) the Google Solar API Default model is filtered out of the dropdown and not selectable, (b) Canadian Solar HiHero (CS6R-440H-AG) from the knowledge vault is missing as a 6th model, and (c) Konva rectangles still render at Google Solar API's default 1.65×0.99m dimensions regardless of which model is selected.

**Implementation:**

- [x] Remove the `.filter((m) => m.id !== 'google-default')` in WorkbenchPage so the Google Default model is selectable
- [x] Add Canadian Solar HiHero (CS6R-440H-AG) as a 6th model in `shared/panelModels.ts` per knowledge vault specs (1722×1134mm, 440Wp, 22.5% efficiency, RM 2.30/Wp)
- [x] Update canvas scale factor to use selected panel model's `widthM`/`heightM` instead of Solar API defaults
- [x] Trigger visual update of all Konva panel rectangles when panel model selection changes
- [x] Verify panel overlap detection still works correctly with new dimensions
- [x] Fix AnalysisPage systemKwp to use selected model's capacityWp instead of buildingInsights default

### 2. Feature: Backend Recompute with Explicit Panel Dimensions

**Purpose/Issue:** The `recompute-flux-batch` endpoint currently reads `panelWidthMeters`/`panelHeightMeters` from the cached Solar API response. When a non-default panel model is selected, flux sampling must use the model's actual dimensions for accurate energy estimates.

**Implementation:**

- [x] Update `recompute-flux-batch` endpoint to accept optional `widthM`/`heightM` parameters
- [x] When provided, use explicit dimensions instead of Solar API cached values for corner computation
- [x] Update single-panel `/recompute` endpoint to accept optional `widthM`/`heightM` parameters
- [x] Update frontend to pass selected model's dimensions in all recompute requests (single, batch on save, initial batch in usePanelState)
- [x] Batch flux recompute on "Save & Continue" already uses selected model dimensions; no auto-recompute on model change (user may switch multiple times before saving)

### 3. Refinement: AnalysisPage Panel Model Display

**Purpose/Issue:** The AnalysisPage summary section does not show which panel model was selected, making it unclear what assumptions underpin the financial analysis.

**Implementation:**

- [x] Display selected panel model name, capacity, and dimensions in the AnalysisPage system summary section
- [x] Include panel model specs in the PDF export report (System Summary card + Assumptions section)

### 4. Maintenance: Seed AFA Default in Production

**Purpose/Issue:** The AFA default was corrected from -2.77 to -2.15 sen/kWh in `prisma/seed.ts`, but the production Supabase database row needs to be re-seeded or manually updated to reflect this change.

**Implementation:**

- [x] Run `npx prisma db seed` against production database (upsert updated the existing RP4-2025 row)
- [x] Verify the tariff config returns the updated AFA default (-2.15 sen/kWh confirmed via Prisma query)

---

## Phase 4.3: AnalysisPage UAT 3 Fixes

### 1. Fix: Degradation Not Applied to Net Benefit Projections (UAT #1)

**Purpose/Issue:** The Net Benefit Projection card (Advanced view) calculates 1yr/5yr/10yr projections using simple `totalSavingsRm * N` without applying the degradation rate. The degradation input field exists and is correctly wired to payback/ROI in `analysis.ts`, but the inline projection display silently ignores it — overstating long-term returns.

**Implementation:**

- [x] Replace `simulation.totalSavingsRm * N - systemCostRm` with degradation-compounded sums: `Σ year1Savings × (1 - degradationRate)^(yr-1)` for yr = 1..N
- [x] Extract a reusable `computeDegradedSavings(year1Savings, degradationRate, years)` helper in `analysis.ts`
- [x] Use the helper in both the Net Benefit Projection card and the existing `buildAnalysisResults()` to avoid drift

### 2. Fix: Month Tab Selection Does Not Update Bill Breakdown (UAT #2)

**Purpose/Issue:** The Bill Component Breakdown's month tabs (Jan–Dec) do not update the displayed values when clicked. The `selectedMonthIndex` state and `selectedMonth` derivation look correct in code, but the UAT tester (solar engineer) confirmed all months show January's values.

**Implementation:**

- [x] Investigate the `selectedMonthIndex` → `selectedMonth` → bill display rendering path for stale state or rendering issues
- [x] Ensure `selectedMonth` reactively updates when month tabs are clicked (add `useMemo` if needed)
- [x] Verify the `simulation.months` array contains distinct per-month values (not duplicated references)

### 3. Fix: Expand/Collapse Toggle for Month-by-Month Table (UAT #5)

**Purpose/Issue:** The `<details open>` element for the Month-by-Month Breakdown does not visually collapse when toggled. Likely a CSS/framework conflict with the native HTML5 `<details>` element.

**Implementation:**

- [x] Replace `<details open>` with a controlled React state toggle using a clickable summary + conditional rendering
- [x] Default to collapsed state to reduce page density (per UAT #2 feedback about cognitive overload)
- [x] Use ChevronDown/ChevronUp icon to indicate toggle state

### 4. Feature: System Assumptions Card (UAT #4)

**Purpose/Issue:** No performance ratio (PR), panel tilt/azimuth, or loss factors are shown. A solar professional expects to see these system-level assumptions. The Solar API already provides roof segment pitch/azimuth data that can be surfaced without new inputs.

**Implementation:**

- [x] Extend `buildingInsights.ts` `RoofSegment` type to include `pitchDegrees` and parse it from the Solar API response
- [x] Add a read-only "System Assumptions" card in the Advanced view showing: assumed PR (80%), primary roof pitch and azimuth from Solar API, panel lifetime, assumed loss factors (soiling, cable, inverter), degradation rate
- [x] Include a note that these are standard industry assumptions, not site-measured values

### 5. Feature: Seasonal Consumption Profile (UAT #3)

**Purpose/Issue:** Consumption input assumes a flat value across all 12 months. Malaysian households have seasonal variation (school holidays, hot dry spells, Ramadan). Even a simple seasonal multiplier improves fidelity.

**Implementation:**

- [x] Define Malaysian seasonal monthly multipliers as a constant (e.g., hot months higher, monsoon months lower, normalized to average 1.0)
- [x] Add a "Consumption Profile" toggle in the form: Flat (current) / Seasonal
- [x] Update `runAnnualSimulation` to accept `number | number[]` for consumption, normalizing to a 12-element array internally
- [x] When Seasonal is selected, multiply base consumption by monthly factors before passing to the simulation
- [x] Persist the profile choice in `analysisConfig`

---

## Phase 4.4: Tooltip & Guidance Pass (Ease-of-Use)

### 1. Feature: Page Onboarding Banners

**Purpose/Issue:** All three UAT participants struggled with page purpose and flow. No page explains what it does or where the user is in the workflow. Two users independently flagged the workbench as opaque (UAT 1 #1 Critical, UAT 2 #3 High) and the map page as bare (UAT 2 #5 Medium).

**Implementation:**

- [x] Add a dismissable onboarding banner to MapPage with step indicator: "Step 1 of 3 — Search for your home address to analyse your rooftop's solar potential."
- [x] Add a dismissable onboarding banner to WorkbenchPage with step indicator: "Step 2 of 3 — Drag, rotate, or remove the solar panels on your roof, then click Save & Continue."
- [x] Add a dismissable onboarding banner to AnalysisPage with step indicator: "Step 3 of 3 — See how much you could save on your electricity bill with solar — adjust your usage below."
- [x] Persist dismissed state in `localStorage` (`slg-onboarding-dismissed-{page}`) so banners only show on first visit

### 2. Feature: Section Guidance Text

**Purpose/Issue:** Section headings use technical language that assumes domain knowledge. Bill breakdown labels like "Capacity" and "Retail" are unexplained. The Simple/Advanced toggle offers no context on what each mode provides. WorkbenchPage sidebar controls lack plain-language guidance (UAT 1 #2, UAT 2 #3).

**Implementation:**

- [x] Add muted text below Simple/Advanced toggle: "Simple shows key savings figures. Advanced adds tariff breakdowns, projections, and system details."
- [x] Change Bill Component Breakdown description to: "See how your TNB bill is calculated — select a month to compare charges with and without solar."
- [x] Add subtitles to "Without Solar" ("What you'd pay at full consumption") and "With Solar" ("Your bill after solar generation offsets your usage under NEM") subheadings
- [x] Update chart descriptions: Monthly Bill Comparison, Cumulative Savings, Net Benefit Projection — replace jargon with plain language
- [x] Add sidebar guidance text to WorkbenchPage: "Use the slider to add or remove panels. Click a panel on the canvas to select it, then rotate or delete it."

### 3. Feature: InfoTooltips for Technical Terms (~25 new)

**Purpose/Issue:** ~22 technical terms shown to users without explanation. Bill components (Energy, Capacity, Network, Retail, AFA, EEI Rebate, RE Fund, SST), NEM credit terms, hero metrics, system assumptions, and the kWp unit are all unexplained. A solar engineer found the numbers accurate but a homeowner could not understand them.

**Implementation:**

- [x] Add tooltips to 4 hero metric cards: Average Monthly Savings, Annual Savings, Simple Payback, CO2 Offset
- [x] Add tooltip to sidebar System Size explaining kWp
- [x] Define `BILL_COMPONENT_TOOLTIPS` lookup constant for 8 bill components (Energy, Capacity, Network, Retail, AFA, EEI Rebate, RE Fund, SST) — apply to labels in both "Without Solar" and "With Solar" columns
- [x] Add tooltips to 4 NEM credit terms in "With Solar" section: Billable kWh, Credit Used, Credit Balance, Credit Forfeited
- [x] Add tooltips to 4 System Assumptions values: Performance Ratio, Roof Azimuth/Pitch, Assumed Losses, DC/AC Ratio
- [x] Add tooltip to WorkbenchPage Annual Yield label

---

## Phase 5: Post-MVP Enhancements and Polish

### 1. Fix: AnalysisPage Bug Fixes and Quick Improvements

**Purpose/Issue:** Multiple issues identified during manual testing: Net Benefit Projection graph always shows all 3 periods regardless of filter, degradation input won't accept values starting with 0, system cost tooltip is misleading, bill breakdown display requires mental math, and several tooltips need clarification.

**Implementation:**

- [x] Fix Net Benefit Projection graph: filter `netBenefitData` by selected `benefitPeriod` so the chart shows only the selected period's bar
- [x] Fix degradation input: preserve raw text during editing to allow intermediate states like "0." before completing "0.5"
- [x] Update System Cost tooltip to explain panel-model-based calculation (`panels × Wp × cost/Wp`) vs the flat RM4,500/kWp fallback
- [x] Update Degradation tooltip to mention its effect on Net Benefit Projection and payback calculations
- [x] Update Roof Azimuth/Pitch tooltip: add compass direction label (e.g., "357° ≈ North") and explain pitch as roof steepness
- [x] Add Panel Lifetime tooltip explaining why it matters for payback and ROI
- [x] Bill Component Breakdown: right side ("With Solar") should show the post-savings total, not the savings amount; add tooltip beside both "Total" labels showing the calculation formula
- [x] Rename "Savings" to "Total Savings" in the Month-by-Month Breakdown table
- [x] Add TNB bill reference image (`assets/tnb-bill-avg-kwh.png`) to the Monthly Consumption tooltip

### 2. Feature: Configurable System Assumptions

**Purpose/Issue:** System Assumptions card shows hardcoded values (PR 80%, losses 20%, DC/AC 1.2). These should be editable in Advanced view so users can adjust based on their specific system. Changes must reflect in the System Assumptions card and any downstream calculations.

**Implementation:**

- [x] Add `performanceRatio`, `assumedLosses`, and `dcAcRatio` to `AnalysisConfig` type and form state with sensible defaults
- [x] Add input fields for these values in the Advanced view sidebar (near existing degradation input)
- [x] Update the System Assumptions card to display the current form values instead of hardcoded constants
- [x] Persist these values in the analysis config save payload

### 3. Feature: Frosted Loading Screen

**Purpose/Issue:** Page transitions show blank loading skeletons. Replace with a visually polished frosted blur overlay with a spinner and rotating hint text for a smoother experience.

**Implementation:**

- [x] Create a reusable `LoadingOverlay` component: frosted `backdrop-blur` overlay, centered spinner, and cycling hint sentences with soft fade-in/out
- [x] Define hint text arrays per page (e.g., "Your rooftop is being analysed...", "Mapping solar panels to your roof...")
- [x] Replace loading skeleton/guard returns in WorkbenchPage and AnalysisPage with `LoadingOverlay`

### 4. Feature: Guided Tour Onboarding System

**Purpose/Issue:** Current onboarding banners are passive — users dismiss them without reading. Replace with an interactive guided tour modal that walks users through key UI elements step by step, with a floating '?' button to retrigger the tour.

**Implementation:**

- [x] Build a `GuidedTour` component: floating positioned modal with title, description, Back/Next navigation, close button inside the modal, highlight/point at target elements
- [x] Define per-page tour step sequences (MapPage: search bar; WorkbenchPage: panel model, count, canvas, save; AnalysisPage: consumption input, view toggle, hero cards, export)
- [x] Add a floating '?' icon button at the bottom-right of every page to retrigger the tour
- [x] Remove old localStorage-based onboarding banners from MapPage, WorkbenchPage, and AnalysisPage
- [x] Auto-show tour on first visit (use localStorage to track whether tour has been completed per page)

### 5. Refinement: Guided Tour & Visual Polish

**Purpose/Issue:** Tour backdrop is too heavy (frosted blur obscures context), modal positioning requires scrolling, tour steps are too few for laypeople, and multiple visual/UX improvements identified during manual testing.

**Implementation:**

- [x] Remove frosted blur from tour backdrop; use a lighter semi-transparent overlay
- [x] Improve tour modal positioning to scroll targets into view with offset padding
- [x] Add more detailed tour steps to all three pages (MapPage, WorkbenchPage, AnalysisPage)
- [x] Make TNB bill image clickable — enlarge as centered popup overlay on click
- [x] Simplify System Cost tooltip: dynamic formula (e.g. "4 × 440 Wp × RM 2.20 = RM 3,872"), rename label to "System Cost (RM)"
- [x] Change Monthly Bill Comparison bar palette to orange (solar theme)
- [x] Rework Net Benefit Projection: scrap period selector, show Year 1–10 bars, fix Y-axis negative tick overflow
- [x] Bold and enlarge "System Assumptions" sidebar label, add descriptive tooltip
- [x] Link PR and Losses dynamically (PR + Losses = 100%); place Assumed Losses beside/below PR in the text card
- [x] Month-by-Month table: swap NEM Bill and Savings columns, rename to "Total Bill" (bold green) and "NEM Savings"
- [x] Add divider between Simple and Advanced configurable variables in sidebar

### 6. Refinement: Navigation and Layout

**Purpose/Issue:** Navigation between pages needs more flexibility. Sidebar descriptions can be more compact. Loading screens should appear on all page transitions.

**Implementation:**

- [x] WorkbenchPage: add "Back to Map" button below "Back to Dashboard"
- [x] WorkbenchPage: move sidebar CardDescription into a tooltip beside the canvas card title "Roof Layout Workbench"
- [x] AnalysisPage: add "Back to Dashboard" button above "Back to Workbench"
- [x] AnalysisPage: move sidebar CardDescription to after the panel specs `<details>` element with a subtle divider
- [x] Ensure LoadingOverlay persists between all three MVP page transitions

### 7. Enhancement: Dashboard Improvements

**Purpose/Issue:** Dashboard currently shows basic project cards. Improve UX before UAT participants see it.

**Implementation:**

- [x] Add last-modified timestamps to project cards
- [x] Add project deletion with confirmation dialog
- [x] Improve project card layout and status badge visibility

### 2. Enhancement: Error Handling Polish

**Purpose/Issue:** Improve user-facing error messages and recovery paths for common failure scenarios.

**Implementation:**

- [x] Review and improve error messages across MapPage (pipeline failures, API errors)
- [x] Add retry mechanisms for transient failures (network timeout, API rate limit)
- [x] Ensure all loading states have timeout fallbacks (no infinite spinners)

### 3. Enhancement: Panel Interaction UX

**Purpose/Issue:** Improve visual feedback on the Workbench for non-technical users.

**Implementation:**

- [x] Add visual feedback on panel hover (highlight, cursor change)
- [x] Improve selection highlight (clearer selected vs. unselected state)
- [x] Add undo last action

### 4. Enhancement: Tooltips and Guided Steps

**Purpose/Issue:** NFR-2 requires straightforward wording and guided steps for non-technical users.

**Implementation:**

- [x] Add tooltips to key Workbench controls (slider, rotation input, delete button)
- [x] Add tooltips to AnalysisPage inputs explaining each assumption
- [x] Add brief onboarding hints on first visit to each page (optional, time permitting)

### 5. Enhancement: Loading Skeleton States

**Purpose/Issue:** Replace plain spinners with skeleton loaders for a more polished feel.

**Implementation:**

- [x] Add skeleton cards to Dashboard while projects load
- [x] Add skeleton state to AnalysisPage while data loads
- [x] Add skeleton/placeholder to WorkbenchPage canvas area during image load

---

## Phase 5.1: MapPage — Interaction Enhancements

### 1. Refinement: MapPage Navigation + UX Cleanup

**Purpose/Issue:** MapPage is functionally complete but visually barebones — no navigation buttons, guided tour button collides with Maps JS zoom controls, default Maps JS UI components clutter the view, and the locked address field gives no guidance on how to start a new project for a different location.

**Implementation:**

- [x] Add "Back to Dashboard" button (always visible)
- [x] Add "Back to Workbench" button (visible when returning from an existing project, i.e. `projectId !== 'new'`)
- [x] Locked address field: change label/placeholder to "Create New Project for New Location" with a CTA button that navigates to `/project/new/map`
- [x] Set `disableDefaultUI: true` on Google Maps instance; re-enable only `zoomControl: true` and `mapTypeControl: true` (satellite toggle)
- [x] Reposition guided tour '?' button to avoid collision with Maps zoom controls (move to bottom-left or use a different anchor)
- [x] General visual polish: consistent card styling around the search area, clearer processing overlay

---

## Phase 5.2: WorkbenchPage — Interaction Enhancements

### 1. Feature: Undo/Redo

**Purpose/Issue:** Users have no way to revert accidental panel moves, rotations, or deletions. A bounded undo/redo stack is essential QoL for the correction workbench.

**Implementation:**

- [x] Create a `useUndoRedo<T>` hook with a bounded history array (max 30 snapshots)
- [x] Capture a panel state snapshot before each mutation (move, rotate, delete, visibility change)
- [x] `undo()` restores the previous snapshot, `redo()` re-applies the undone change
- [x] Wire keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
- [x] Add undo/redo icon buttons to canvas controls toolbar (top-right)
- [x] Disable buttons at history boundaries (start = no undo, end = no redo)
- [x] Clear redo stack when a new action is performed after an undo

### 2. Feature: Multi-Select + Group Operations + Rectangular Marquee

**Purpose/Issue:** Single-panel-at-a-time editing is tedious for large layouts. Users need to select multiple panels and operate on them as a group. A rectangular marquee tool (Photoshop-style click+drag selection) makes bulk selection efficient.

**Implementation:**

- [x] Change `selectedPanelId: string | null` → `selectedPanelIds: Set<string>`
- [x] Shift+click toggles a panel in/out of selection set; regular click clears set and selects one
- [x] Distinct visual style for multi-selected panels (e.g. cyan stroke vs white for single-select)
- [x] Group drag: compute pixel delta from the dragged panel, apply same delta to all selected panels, validate all placements (mask + bounds + overlap), rollback entire group if any fails
- [x] Group rotate: apply rotation delta to all selected, debounced batch recompute
- [x] Group delete: Delete key removes all selected panels at once
- [x] Click empty canvas area to deselect all
- [x] **Rectangular Marquee Tool:** toggle via canvas controls toolbar button. When active, click+drag on empty Stage area draws a dashed selection rectangle (Konva `Rect`). On `mouseup`, select all panels whose pixel centers fall within the rectangle bounds. Implemented via `Stage` event handlers (`mousedown`/`mousemove`/`mouseup`) with a temporary Konva `Rect` overlay
- [x] Add multi-select and marquee toggle buttons to canvas controls toolbar

### 3. Feature: Snap Alignment

**Purpose/Issue:** Panels placed freely often end up slightly misaligned, creating messy layouts. Snap-to-edge alignment with visual guide lines produces cleaner, more professional panel arrays.

**Implementation:**

- [x] During `dragBoundFunc` (fires every frame while dragging), compare the dragged panel's edges against all other visible panels' edges
- [x] For panels at similar rotation (±5°), compute edge distances: top↔top, top↔bottom, left↔left, left↔right
- [x] If any distance is within snap threshold (~8 display pixels), snap the dragged position to align that edge
- [x] Render temporary `Konva.Line` elements as alignment guide lines (thin cyan lines) when snap is active
- [x] Add a snap toggle button (magnet icon) to canvas controls — default on, click to toggle off

### 4. Feature: Roof Segment Visualization

**Purpose/Issue:** Users — especially terrace homeowners — cannot tell which roof face they're placing panels on. Google Solar API provides per-segment stats (azimuth, pitch, area) and each panel's `segmentIndex`, but no polygon boundaries. Use panel grouping + convex hull as an approximation.

**Implementation:**

- [x] Group panels by `segmentIndex` from `buildingInsights.solarPotential.solarPanels`
- [x] Compute the convex hull of each group's pixel centers → render as semi-transparent `Konva.Line` closed polygon
- [x] Color-code by azimuth: warm tones (amber/red) for south-facing, cool tones (blue/teal) for north-facing
- [x] Panel fill tint follows segment color when segment view is active
- [x] Show segment metadata on hover/click of hull outline: azimuth (°), pitch (°), panel count
- [x] Add "Segments" toggle to the overlay dropdown (alongside RGB / Flux / DSM / Mask)
- [x] When segment view is off, revert to default yield-based color gradient

### 5. Feature: Canvas Controls Expansion

**Purpose/Issue:** Current canvas controls only have zoom in/out/reset and overlay dropdown. New tools need a home.

**Implementation:**

- [x] Reorganize canvas controls into grouped sections: **Navigation** (zoom in/out/reset), **Tools** (undo/redo, multi-select toggle, marquee toggle, snap toggle), **Overlays** (RGB/flux/DSM/mask/segments dropdown)
- [x] Add dividers or visual grouping between sections
- [x] Add tooltips to every control button
- [x] Ensure controls remain accessible when zoomed/panned (fixed position relative to viewport, not canvas)

### 6. Feature: Mask Overlay

**Purpose/Issue:** Users don't understand why certain panel placements are rejected. Showing the roof mask overlay reveals the valid rooftop boundary the system uses for validation.

**Implementation:**

- [x] Add "Mask" option to the overlay view dropdown
- [x] Backend: extend `GET /api/locations/:locationId/overlay/mask` to serve the decoded `mask.tif` as a colorized PNG (green = valid roof, transparent = off-roof), cached in Supabase Storage
- [x] Frontend: display the mask overlay on the Konva canvas (same mechanism as flux/DSM overlays)

### 7. Feature: Panel Model Selector Redesign — Bottom Drawer with 3D Previews

**Purpose/Issue:** The current sidebar `<select>` dropdown is functional but lacks visual engagement. Replace with an immersive bottom-sheet drawer featuring 3D spinning panel previews — an "avatar selection" experience that showcases available panel models.

**Implementation:**

- [x] Install `three`, `@react-three/fiber`, `@react-three/drei` as frontend dependencies
- [x] Lazy-load Three.js components (`React.lazy` + `Suspense`) — only loaded when drawer opens
- [x] Create a bottom-sheet drawer component using `vaul` (shadcn's drawer primitive), slides up from mid-bottom
- [x] Trigger: clicking the panel model name/area in the sidebar opens the drawer
- [x] Inside drawer: horizontal scrollable flex container of model cards
- [x] Each card: model name, manufacturer badge, key specs (Wp, efficiency, dimensions, RM/Wp)
- [x] Each card contains a `<Canvas>` (~200×150px) with a spinning 3D solar panel:
  - `<Box>` geometry proportioned to real widthM × heightM × 0.04m
  - Dark blue/black cell material, metallic silver frame edges
  - `<OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} />`
  - Ambient + directional lighting
- [x] Selected model: highlighted border glow + checkmark badge
- [x] Click model card → select it, close drawer, trigger batch recompute (same flow as current dropdown)
- [x] Fallback: if WebGL unavailable, render static panel images instead of 3D canvases

### 8. Feature: Irradiance Ambient Indicator

**Purpose/Issue:** Users have no intuitive sense of where the sun shines on their roof throughout the year. An ambient directional glow around the canvas, driven by a month slider, visually communicates sun direction and intensity without any technical knowledge required. The glow must be prominent enough to be immediately perceivable.

**Implementation:**

- [x] Wrap the Konva stage container in a relative-positioned div with a `pointer-events: none` overlay for the glow
- [x] Compute sun azimuth per month from a simple solar position formula for Malaysia (~3°N latitude)
- [x] Render a directional radial gradient: warm golden-amber (#FFB800 → transparent), origin at the canvas edge corresponding to the sun azimuth
- [x] Gradient opacity scaled by month's relative irradiance (peak months = strong glow, monsoon months = dimmer)
- [x] Glow must be visually prominent — an obvious directional light wash, not a subtle tint
- [x] Month selector: horizontal **slider** (range input, 0–11) below the canvas, with active month label (Jan–Dec)
- [x] Slider reactively drives glow direction + intensity

---

## Phase 5.3: AnalysisPage — Interaction Enhancements

### 1. Feature: 1-Page Simple PDF for Homeowners

**Purpose/Issue:** The current PDF export generates the full detailed report regardless of view mode. Homeowners using Simple view should get a clean 1-page summary instead — hero metrics, monthly bill comparison chart, and a plain-language summary paragraph.

**Implementation:**

- [x] Create a separate Simple PDF layout (hidden off-screen) with: project name, hero metrics (monthly savings, payback, CO₂), monthly bill comparison table, and plain-language summary paragraph
- [x] When in Simple view, "Export PDF" triggers the 1-page layout instead of the full report
- [x] Advanced view continues to use the existing full multi-page report

### 2. Feature: System Cost Accuracy & Financial Transparency

**Purpose/Issue:** Panel model `costPerWp` values represent module cost only (~45% of turnkey), causing system cost to be underestimated by ~50% (e.g. RM 3,872 instead of ~RM 7,744 for a 1.6kWp Jinko setup). Additionally, the analysis page lacked transparency about cost assumptions and a long-term financial overview.

**Implementation:**

- [x] Add `DEFAULT_INSTALLATION_MULTIPLIER = 2.0` constant in `analysis.ts` to convert panel module cost to turnkey installed cost (covers inverter, mounting, wiring, labour, permitting)
- [x] Apply multiplier in AnalysisPage system cost computation for panel-model path
- [x] Update System Cost tooltip to show full breakdown with plain-English explanation of the multiplier
- [x] Expand Financial Disclaimers with system cost methodology and exclusions (maintenance, inverter replacement, tariff escalation)
- [x] Add Financial Roadmap card (Advanced view) after Net Benefit Projection — dynamic milestones (investment, break-even, inverter replacement window, warranty end)
- [x] Clarify `costPerWp` comments in `panelModels.ts` and `shared/index.ts`

---

## Phase 6: UI/UX Identity Rework

### 1. Refinement: Solar-Themed Visual Identity

**Purpose/Issue:** The app currently uses default shadcn/Tailwind styling (stone/gray palette). It works but lacks a cohesive "solar tool" identity. A defined color palette and consistent component styling would make it feel purpose-built.

**Implementation:**

- [x] Define solar color palette (orange-based) with full light/dark mode CSS variables
- [x] Update Tailwind theme with solar colour tokens and font families
- [x] Apply palette across key surfaces: glassmorphism cards, charts, buttons, borders
- [x] Solar-themed favicon and page title
- [x] Gradient backgrounds and glow orbs on page shells

### 2. Fix: VSCode Workspace TypeScript Issues

**Purpose/Issue:** VSCode using wrong tsserver path due to Windows backslashes in settings, missing ignoreDeprecations for baseUrl.

**Implementation:**

- [x] Fix `.vscode/settings.json` to use forward slashes and point to frontend TS
- [x] Add `ignoreDeprecations: "5.0"` to `frontend/tsconfig.json`

### 3. Fix: General CSS/Theming

**Purpose/Issue:** Glass effects broken on Heroku, loading spinner not spinning, no custom scrollbars, toast position wrong, header/footer missing on full-screen pages.

**Implementation:**

- [x] Strengthen glassmorphism tokens (higher opacity values for glass-bg, glass-border)
- [x] Add explicit `spin` keyframe to design system (Tailwind v4 needs it registered)
- [x] Add custom themed scrollbar CSS (light/dark via CSS variables)
- [x] Set Sonner toast position to `bottom-center`
- [x] Always show header + footer on all pages (removed `noFooter` prop)
- [x] Add section comments/labels to `index.css` for easier editing

### 4. Feature: Dashboard Overhaul with Nav Sidebar

**Purpose/Issue:** Dashboard lacked proper SaaS structure. Needed nav sidebar, subpages, notification button, cleaner layout.

**Implementation:**

- [x] Add collapsible nav sidebar (collapsed by default, expands on hover, smooth animations)
- [x] Introduce 3 subpages: Summary, Projects, Analytics
- [x] Summary subpage: hero banner, quick stats row, solar performance stats, recent projects, getting started tips
- [x] Projects subpage: full project list with filter tabs (All/Completed/In Progress), 3-column grid
- [x] Analytics subpage: aggregated metrics, averages per project, project breakdown table
- [x] Remove redundant sidebar components (Quick Actions, How It Works, Solar Fact) from main content
- [x] Install `framer-motion` and create `NotificationPopover` component (21st Dev pattern)
- [x] Add notification button to `AppNav` (left of theme toggle)

### 5. Feature: MapPage UI Improvements

**Purpose/Issue:** Map spans full screen without containerization, pending project view lacks nav, address input too transparent.

**Implementation:**

- [x] Remove zoom control from Google Maps (keep map type control only)
- [x] Containerize map in rounded bordered viewport with padding
- [x] Readonly view: add nav card with "Back to Dashboard" and "Proceed to Workbench" buttons
- [x] Readonly view: show subtext below locked search bar with "new project" hyperlink to dashboard
- [x] Make search bar less transparent (`bg-card/95` with shadow)

### 6. Fix: WorkbenchPage UI Issues

**Purpose/Issue:** Panel model buttons inconsistent sizes, canvas controls overflow container.

**Implementation:**

- [x] Fix panel model card width to consistent `w-[200px]` with `shrink-0`
- [x] Add `max-h-[calc(100%-2rem)]` and `overflow-y-auto` to canvas controls container
- [x] Replace hardcoded `ring-stone-400` with `ring-muted-foreground`

### 7. Fix: AnalysisPage UI Issues and Tooltips

**Purpose/Issue:** Panel spec missing on direct dashboard entry, cumulative savings y-axis overflow, no tooltips on charts.

**Implementation:**

- [x] Fix panel model detection fallback to `DEFAULT_PANEL_MODEL_ID` for projects without saved model ID
- [x] Fix cumulative savings chart y-axis overflow with `width={70}` and `margin={{ left: 8 }}`
- [x] Add info tooltips to: Monthly Bill Comparison, Cumulative Savings, Net Benefit Projection, Bill Component Breakdown, Month-by-Month Breakdown, System Assumptions

---

## Phase X: Final Documentation

### 1. ...

**Purpose/Issue:** ...

**Implementation:**

- [ ] ...

---
