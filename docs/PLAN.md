# PLAN - AGENT ONLY

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

## Phase 2.2: Manual QA Follow-up

### 1. Refinement: MapPage Polling + Places Modernization

**Purpose/Issue:** Manual QA exposed a new-project polling deadlock (`GET /api/locations/:id/status` returned 404 before a `Project` existed), while Google Maps flagged the legacy Places Autocomplete path as deprecated for new customers.

**Implementation:**

- [x] Allow `GET /api/locations/:id/status` to return status for orphan `Location` records during the new-project analysis window, while keeping `GET /api/locations/:id/data` tied to owned projects
- [x] Add a backend regression test for the orphan-status ownership filter so the Phase 2 new-project flow stays covered
- [x] Update `MapPage` to load the newer `PlaceAutocompleteElement` via `google.maps.importLibrary('places')` when available, with legacy autocomplete retained only as a compatibility fallback
- [x] Fail the processing state cleanly when polling errors occur instead of leaving the UI stuck on "Analyzing your rooftop..."
- [x] Guard ready-state project creation so repeated polling responses cannot create duplicate projects before navigation completes

## Phase 3: Frontend - Billing Engine, Page 3, PDF Export

### 1. Refinement: Workbench Placement + Energy Consistency

**Purpose/Issue:** Phase 2 Workbench currently constrains panels to the RGB image bounds and overlap checks, but not the true roof mask boundary. In addition, untouched panels still rely on their original annual yield until recompute produces monthly values, which needs a defined AnalysisPage strategy before edited layouts are consumed downstream.

**Implementation:**

- [ ] Expose or derive usable roof/mask boundary data for the frontend so Workbench placement validation can reject panels outside the valid rooftop area instead of only outside the image bounds
- [ ] Define and implement how Analysis consumes `editedLayout` when some panels have not been recomputed in Phase 2, so monthly energy data is consistent for both untouched and edited panels

### 2. Refinement: React Error Boundary

**Purpose/Issue:** QA Phase 2 follow-up #6 — no top-level error boundary exists. If `AuthProvider` or any root-level query throws, users see a white screen with no recovery path.

**Implementation:**

- [ ] Add a React error boundary component wrapping the app in `App.tsx` or `main.tsx`
- [ ] Display a user-friendly fallback UI with a "Return to Dashboard" or "Reload" action
