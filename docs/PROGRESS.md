# PROGRESS - AGENT ONLY

## [24/03/26] - Phase 4.2 Task 4: Seed AFA Default in Production

- Ran `npm run db:seed` against production Supabase database. The upsert updated the existing RP4-2025 tariff config row with `afaRateDefault: -2.15` (previously -2.77).
- Verified via Prisma query: `afaRateDefault: -2.15` confirmed in the live database.

## [24/03/26] - Phase 4.2 Task 3: AnalysisPage Panel Model Display

- **Main UI:** Added a panel model info card below the System Size / Active Panels grid in the AnalysisPage sidebar, showing model name, capacity (Wp), dimensions, and efficiency.
- **PDF Export:** Added panel model name and capacity to the System Summary card and panel model specs (name, capacity, dimensions) to the Assumptions Used section.
- **Verification:** `tsc -b` clean. 47 frontend tests pass.

## [24/03/26] - Phase 4.2 Task 2: Backend Recompute with Explicit Panel Dimensions

- **Shared Types:** Added optional `widthM`/`heightM` fields to `FluxRecomputeRequest` in `shared/index.ts`.
- **Backend Validator:** Added optional `widthM`/`heightM` (positive number) to Zod schemas for both single and batch recompute endpoints.
- **Backend Route:** Both `/recompute` and `/recompute-batch` now use request-provided `widthM`/`heightM` when available, falling back to `buildingInsightsJson` values. Batch endpoint computes default pixel dimensions once and overrides per-panel when explicit dimensions are provided.
- **Frontend Passthrough:** All three recompute call sites now pass the selected panel model's dimensions:
  - Single-panel recompute on drag/rotate (WorkbenchPage `recomputePanel`)
  - Batch recompute on "Save & Continue" (WorkbenchPage `handleSaveAndContinue`)
  - Initial batch recompute on page load (`usePanelState` hook)
- **Verification:** `tsc -b` clean across all 3 workspaces. 47 frontend tests pass, 24 backend tests pass.

## [24/03/26] - Phase 4.2 Task 1: Panel Model List Fixes + Dimension-Aware Rendering

- **Google Default Model Visible:** Removed the `.filter()` that excluded the Google Solar API Default model from the WorkbenchPage panel model dropdown. All 6 models are now selectable.
- **Canadian Solar HiHero Added:** Added Canadian Solar HiHero (CS6R-440H-AG) as 6th panel model in `shared/panelModels.ts` with knowledge vault specs (1722×1134mm, 440Wp, 22.5% efficiency, RM 2.30/Wp).
- **Dimension-Aware Konva Rendering:** Updated `panelDimensions` and `maskPanelDimensions` memos in WorkbenchPage to use the selected panel model's `widthM`/`heightM` instead of `buildingInsights.solarPotential.panelWidthMeters/HeightMeters`. Konva rectangles, overlap detection (AABB), stage bounds checks, and roof mask boundary validation all now react to model selection changes.
- **AnalysisPage Capacity Fix:** `systemKwp` and `localSystemKwp` now use the selected panel model's `capacityWp` (with fallback to buildingInsights), fixing an inconsistency where cost used the selected model but capacity still used the Google Solar API default.
- **Verification:** `tsc -b` clean across all 3 workspaces. 47 frontend tests pass, 24 backend tests pass.

## [24/03/26] - Phase 4.4: Knowledge Vault Corrections

- **Knowledge Vault Documents Added:** `docs/MVP-PAGE-2-KNOWLEDGE-VAULT.md` (Malaysian panel models, specs, dimensions, costs) and `docs/MVP-PAGE-3-KNOWLEDGE-VAULT.md` (NEM billing methodology, TNB tariff rates, financial parameters).
- **Gap Analysis Completed:** Cross-referenced billing engine and workbench code against both knowledge vaults. Tariff rates and NEM mechanism were correct; identified gaps in AFA default rate, SST proration, degradation modeling, final rounding, and panel model selection.
- **Billing Engine Corrections:**
  - Updated AFA default from -2.77 to -2.15 sen/kWh (March 2026 rate) in `prisma/seed.ts`.
  - Fixed SST proration: now applies 8% only to the portion of the bill attributable to consumption above 600 kWh, not the full subtotal.
  - Added 5-sen final rounding (`round5sen`) to bill totals per government rounding rules.
  - Added degradation-aware financial projections (0.5%/year default for N-type panels): payback now iterates year-by-year with degraded savings; 10-year ROI sums degraded annual savings.
  - Added `degradationRate` field to `AnalysisConfig` and AnalysisPage form.
  - Updated billing engine tests — 49 tests pass (38 billing + existing).
- **Multi-Panel Model Selection:**
  - Defined `PanelModel` type in `shared/index.ts` and created `shared/panelModels.ts` with 5 seeded models (Google Solar API default, Jinko Tiger Neo, LONGi Hi-MO 6, JA Solar DeepBlue 4.0, Trina Vertex S+) sourced from Knowledge Vault.
  - Added panel model selector dropdown on WorkbenchPage sidebar above panel quantity slider.
  - Selected model's dimensions, capacity, and efficiency displayed in Panel Specifications section.
  - `selectedPanelModelId` persisted in project's `analysisConfig` via save-layout endpoint.
  - AnalysisPage now computes system cost from selected model's `costPerWp` instead of flat tariff default.
  - Backend validator updated to accept `selectedPanelModelId` in save-layout requests.
- **Verification:** All three workspaces (shared, backend, frontend) pass `tsc --noEmit` cleanly.

## [24/03/26] - Phase 4: GitHub Actions CI/CD for Heroku

- Added a root `npm test` script so the monorepo has a single CI entrypoint for frontend and backend unit tests.
- Added `.github/workflows/ci-cd.yml` to run install, build, and tests on pull requests, then deploy `main` to Heroku automatically after CI passes using authenticated Heroku Git deployment.
- Updated `README.md` with the new GitHub Actions release flow, required repository secrets, and the revised role of manual `git push heroku main` as a fallback only.

## [17/03/26] - Phase 5.2: Tooltips + Loading Skeleton States

- **Tooltips:** Installed shadcn/ui Tooltip component. Created reusable `InfoTooltip` component (info icon with hover popup). Added tooltips to WorkbenchPage controls: Panel Quantity slider, Selected Panel label, and Rotate Panel input. Added tooltips to AnalysisPage inputs: Monthly Consumption, Connection Phase, System Cost, and AFA Rate — each explaining the field's purpose in plain language for non-technical users.
- **Loading Skeletons:** Installed shadcn/ui Skeleton component. Replaced Dashboard spinner with 4 skeleton project cards matching the real card layout. Replaced WorkbenchPage spinner with a full skeleton layout mimicking the sidebar + canvas structure. Replaced AnalysisPage spinner with skeleton sidebar inputs + hero metric cards + chart placeholder.

## [17/03/26] - Phase 5.1: Dashboard, Error Handling, Panel UX Enhancements

- **Dashboard Improvements:** Added relative timestamps ("2h ago", "3d ago") showing last-modified time alongside creation date. Added project deletion with confirmation dialog (new `DELETE /api/projects/:id` backend endpoint + `deleteProject` service + frontend API client). Status badges now use distinct variants (outline/secondary/default) for draft/layout_saved/analysis_saved. Delete button appears on card hover. Added lucide-react icons (Plus, LogOut, Trash2, Clock) and toast notifications for delete feedback.
- **Error Handling Polish (MapPage):** Added 2-minute processing timeout fallback to prevent infinite "Analyzing your rooftop" spinner. Improved Google Maps load error screen with icon, reload button, and dashboard link. Improved failed-state overlay with alert icon, descriptive error messages, and dual-action buttons (Try Another Location + Dashboard). Added lucide-react icons (AlertTriangle, ArrowLeft, Loader2, MapPin). Processing overlay now shows estimated wait time ("15–30 seconds").
- **Panel Interaction UX (PanelRect):** Added hover state with increased opacity, subtle white stroke, and enlarged shadow on mouse enter. Cursor changes contextually: pointer (hoverable), move (selected), not-allowed (disabled). Selected panels now use bright white stroke with stronger shadow. Disabled panels show reduced opacity.

## [17/03/26] - Phase 4.1: Landing Page + README

- **Landing Page:** Replaced the placeholder landing page with a full product page featuring: hero section with tagline and dual CTAs, "How It Works" 3-step workflow cards (Search → Adjust → Analyse) with lucide-react icons and step badges, key features section (satellite data, interactive workbench, NEM billing, PDF export) using shadcn Card components, amber-styled disclaimers callout, bottom CTA section, and footer with FYP attribution and SDG 7 alignment. Fully responsive with sm/lg breakpoints. Authenticated users still auto-redirect to dashboard.
- **README.md:** Expanded from basic info to comprehensive documentation: project description, features list, architecture diagram, tech stack table, full local dev setup guide (clone, env vars, database, dev servers), commands reference, project structure tree, Heroku deployment steps, testing instructions, and acknowledgements section.

## [15/03/26] - Phase 3.2: Database Reconciliation

- Added committed Prisma migration `20260315113000_add_tariff_defaults` so the `TariffConfig.defaults` column is now represented in repo history instead of existing only in the live database schema.
- Reconciled the live Supabase `_prisma_migrations` ledger: the previously manual `20260305000001_add_tariff_version_unique` change is now recorded as applied, and the new defaults migration was deployed successfully.
- Updated Prisma seeding to run via `node ../prisma/seed.ts` instead of the `tsx` runner, which removes the Windows/Linux `esbuild` binary mismatch that was breaking `npm run db:seed` in this checkout.
- Re-verified the live tariff config row after reconciliation: `RP4-2025` is present and still contains the expected `defaults` JSON payload used by the Analysis page.

## [10/03/26] - Phase 3.1: QA Audit Fixes

- **Project save responses:** Updated backend `saveLayout` and `saveAnalysis` mutations to return `include: { location: true }`, so the Analysis page cache no longer loses location metadata after save and the PDF/report keeps showing the project coordinates.
- **Save-analysis validation hardening:** Replaced the unstructured `z.record(z.unknown())` validator with typed-but-extensible Zod shapes for `analysisConfig`, `analysisResults`, monthly breakdown rows, and bill component objects. This now rejects malformed analysis payloads instead of silently accepting unusable shapes.
- **Tariff fallback visibility:** Kept the existing tariff defaults fallback for backward compatibility, but the tariff route now logs a warning when the database row is missing `defaults`, making stale seed data visible instead of silent.
- **Threshold warning accuracy:** Updated the Analysis warning builder to combine retail/AFA/SST messaging only when those thresholds truly match, and to emit separate warnings when the configured thresholds diverge. Added frontend tests for both the combined and split cases.
- **Workbench save cleanup:** Removed the redundant local `updatePanelEnergies()` state write from the Workbench batch-save path because the user navigates away immediately after persisting the recomputed layout payload.
- **Analysis display fixes:** Corrected the month table so "Net Import" now shows true `consumption - generation`, and expanded the "With Solar" bill breakdown to include retail, AFA, EEI rebate, and RE Fund line items alongside the NEM-specific credit values.
- **AFA input guidance:** Kept support for negative AFA values (rebates), but constrained the input to a reasonable `-10` to `10` sen/kWh range and clarified the helper text so QA/users do not treat negative AFA as invalid.

## [09/03/26] - Phase 3: Error Boundary, Workbench Batch Save, Analysis Page

- **Task 4 — React Error Boundary:** Added `frontend/src/components/AppErrorBoundary.tsx` and wrapped the app shell in `main.tsx` so root render/auth/query failures now show a recovery card with Reload and Return to Dashboard actions instead of a white screen. Also mounted the Sonner toaster at the root for later save/export feedback.
- **Task 2 — Workbench Batch Recompute on Save:** Updated `WorkbenchPage` so "Save & Continue" now batches all active panels through `POST /api/locations/:locationId/panels/recompute-batch`, validates that each active panel returns a full 12-month response, updates local panel energy state, and only then persists the refreshed layout to the backend. Save now shows a blocking batch-recompute progress state and refuses partial/incomplete batch results.
- **Task 3 — Workbench Roof Mask Boundary:** Extended `GET /api/locations/:id/data` to return a decoded roof-mask payload from the cached `mask.tif` alongside the existing GeoTIFF metadata. The frontend now decodes that raster once, projects candidate placements into mask pixel space, and rejects drag/rotation placements that leave the true rooftop mask even if they are still inside the image bounds.
- **Task 8 — AnalysisPage Data Loading + User Inputs:** Replaced the placeholder Page 3 with TanStack Query loading for project, tariff config, and location data; derives active-panel monthly generation and system kWp from the saved layout; restores saved assumptions when revisiting `analysis_saved` projects; and reactively re-runs the billing engine whenever monthly consumption, connection phase, system cost, or AFA changes.
- **Task 9 — Analysis Results Display:** Added hero metrics for savings/payback/CO2, Recharts monthly comparison and cumulative savings visuals, selected-month bill component breakdowns, threshold-crossing warnings, an expandable month-by-month table, and the required financial disclaimer block.
- **Task 10 — PDF Export:** Added client-side PDF export using `html2pdf.js` against an off-screen A4 report layout that includes system summary, assumptions, bill comparison, monthly table, and disclaimers. Export filenames follow `Solar_Analysis_{projectName}_{date}.pdf`.
- **Task 11 — Save Analysis + Navigation:** Wired "Save Analysis" to `PATCH /api/projects/:id/analysis` with typed `analysisConfig` and `analysisResults` payloads, shows a confirmation toast on success, updates the cached project status, and keeps the Workbench return link available for layout revisions.

## [09/03/26] - Phase 3: Batch Recompute, TariffConfig Defaults, Billing Engine

- **Task 1 — Batch Recompute Endpoint:** Added `POST /api/locations/:locationId/panels/recompute-batch` that downloads the `monthly_flux.tif` once, pre-reads all 12 bands into memory via `preloadFluxRasters()`, then processes N panels using `computeMonthlyEnergyFromRasters()` (pure, no I/O per panel). Added `fluxRecomputeBatchSchema` (Zod, max 500 panels), `FluxRecomputeBatchRequest`/`FluxRecomputeBatchResponse` shared types, and `recomputeFluxBatch()` frontend API client. Existing single-panel endpoint unchanged.
- **Task 5 — TariffConfig Defaults:** Added `defaults` JSON column to `TariffConfig` Prisma model (`db push`). Updated `seed.ts` with `nemCapSinglePhaseKw` (5), `nemCapThreePhaseKw` (12.5), `systemCostPerKwp` (4500), `annualYieldPerKwp` (1200). Re-seeded. Typed `TariffRates`, `TariffThresholds`, `TariffDefaults` in `shared/index.ts` (replaces `Record<string, unknown>`). Updated `GET /api/tariff/config` to return the new `defaults` field with hardcoded fallback for unseeded rows.
- **Task 6 — Billing Engine:** Created `frontend/src/lib/billingEngine.ts` with `computeBill()` (10-step baseline), `lookupEeiRebate()`, `computeNemMonth()` (credit carry-forward + December forfeiture), and `runAnnualSimulation()` (12-month loop). All tariff parameters sourced from `BillingConfig` at runtime — zero hardcoded rates. Line items rounded individually to match real utility billing.
- **Task 7 — Billing Engine Tests:** Created `frontend/src/lib/billingEngine.test.ts` with 36 tests covering golden cases T1–T5, T10, EEI bracket lookups, threshold boundaries (300/600/601/1500/1501 kWh), credit carry-forward, December forfeiture, annual simulation invariants. All golden cases match Knowledge Vault within RM0.01 (two 1-cent diffs documented as KV manual rounding errors in energy component for 640 kWh).
- **Verification:** 24 backend tests pass, 43 frontend tests pass (7 existing + 36 new), full build (shared → Prisma → backend → frontend) succeeds.

## [08/03/26] - Phase 2.5: Location Cache Smoke Test

- Added `tests/smoke/smoke-location-cache.sh` to exercise the real Page 1 cache path through the backend rather than calling Google Solar directly, since the cache behavior under test lives behind `POST /api/locations/resolve`.
- The smoke script creates a temporary Supabase auth user, resolves a target coordinate, polls until the location is `ready`, inspects the `Location` row via Prisma, and confirms the expected cached artifacts (`buildingInsightsJson`, `rgbImageUrl`, `monthlyFluxPath`, `maskPath`) were persisted to Supabase-backed storage/metadata.
- The script then creates a first project, repeats the same resolve flow with the same coordinates, creates a second project, and asserts both project flows land on the same cached `locationId` without increasing the number of `Location` rows in the coordinate tolerance window.
- Added a warm-cache override (`CACHE_ALLOW_WARM=1`) so the same script can verify reuse behavior on an already-cached coordinate during troubleshooting, while cold-cache mode intentionally fails fast if the coordinate has already been cached.
- Verification so far is a shell syntax pass only (`bash -n tests/smoke/smoke-location-cache.sh`); the live Solar API-backed smoke run is intentionally left to the user so it can be pointed at a chosen test coordinate.
- Further manual testing by ZJ confirmed that cached location does not consume additional Solar API endpoint calls.

## [07/03/26] - Phase 2.4: Workbench Rendering Alignment

- Replaced the frontend Workbench's building-bounding-box approximation with reference GeoTIFF transform data derived from the stored `rgb.tif` (fallback `dsm.tif`), matching the validated prototype's rendering workflow.
- Extended `GET /api/locations/:id/data` to return `imageGeoTransform` metadata (origin, resolution, CRS, intrinsic image size) alongside the signed rooftop PNG URL for Workbench rendering.
- Updated frontend `canvasTransforms.ts` to use `proj4` with the reference GeoTIFF transform and display scaling, so panel centers and dimensions are computed in the same projected image space as the prototype.
- Normalized positive GeoTIFF Y resolutions in `backend/src/geo/transforms.ts` so both Workbench rendering and backend recompute interpret image rows top-down correctly for the real Google Solar `rgb.tif` files.
- Added a backend transform test for Y-resolution normalization and updated the frontend transform tests to cover the projected-CRS rendering path.
- Ran a live sanity check against the latest location data: panel centers now cluster within the `439x439` rooftop image bounds instead of stretching across the full image.

## [07/03/26] - Phase 2.3: Workbench Bootstrap + Runtime Logging

- Fixed a Workbench bootstrap deadlock where the page waited for `panelDimensions` before rendering the canvas container that `panelDimensions` depended on, which could trap Page 2 on the full-screen "Preparing the workbench..." loader.
- Narrowed the top-level Workbench loading gate to true data prerequisites only and kept canvas sizing/loading inside the rendered page so stage measurement can complete normally.
- Added explicit Workbench errors for missing linked `locationId`, missing signed rooftop image URL, and stalled image loading instead of silently treating those cases as loading forever.
- Added frontend dev-console logging for API requests, Workbench data state, and rooftop image loading so manual QA can see which prerequisite is pending.
- Added backend request, auth, route, and pipeline logging across project fetch/create, location resolve/status/data, signed rooftop image generation, recompute, and file uploads to improve troubleshooting from the terminal.
- Hardened `GET /api/locations/:id/data` so a `ready` location now fails clearly if `buildingInsightsJson` or `rgbImageUrl` is missing instead of returning a partial success payload.
- Verification: `npm run build --workspace=backend`, `npm run build --workspace=frontend`, `npm exec --workspace=backend -- vitest run`, and `npm run test --workspace=frontend` all pass.

## [06/03/26] - Phase 2.2: MapPage Polling + Places Follow-up

- Fixed the new-project MapPage polling deadlock by allowing authenticated users to poll orphan `Location` records during rooftop analysis before a `Project` is created.
- Added `backend/src/services/locationService.test.ts` to lock the ownership query behavior for status polling versus owned location-data access.
- Updated `MapPage` to initialize the newer Google Places `PlaceAutocompleteElement` through `google.maps.importLibrary('places')`, while retaining legacy autocomplete only as a fallback path.
- Added explicit polling-error handling so `GET /api/locations/:id/status` failures surface a recoverable error instead of leaving the UI stuck in the processing state.
- Added a ready-state guard so repeated polling responses cannot trigger duplicate `POST /api/projects` calls before the app navigates to Workbench.
- Verification: `npm exec --workspace=backend -- vitest run`, `npm run test --workspace=frontend`, and root `npm run build` all pass.

## [06/03/26] - Phase 2.1: QA Fixes for MapPage + Workbench

- Reworked `MapPage` so the Google Maps address search is rendered as a visible React overlay input while still using Google Places Autocomplete under the hood.
- Added `sessionStorage` draft persistence for the new-project flow so project name, pending `locationId`, and processing state survive refreshes until the project is created.
- Fixed Workbench invalid-drag behavior by snapping rejected Konva nodes back immediately and reusing the same reset path on recompute rollback.
- Normalized the rotation field's displayed value on input so out-of-range typed values do not linger visually.
- Added frontend Vitest coverage for `buildingInsights.ts`, `canvasTransforms.ts`, and `usePanelState.ts`.
- Verification: `npm run test --workspace=frontend`, `npm run build --workspace=frontend`, and root `npm run build` all pass.

## [06/03/26] - Phase 2 Tasks 9 to 11: WorkbenchPage

- **Task 9:** Added Workbench data loading (`hooks/useWorkbenchData.ts`) and runtime building-insights parsing (`lib/buildingInsights.ts`) so the page can safely consume signed RGB URLs and Google Solar payload fields without unsafe casts.
- **Task 9:** Added frontend canvas transform helpers (`lib/canvasTransforms.ts`) to convert lat/lng display pixels from `buildingInsights.boundingBox`, plus panel dimension conversion from meters to canvas pixels.
- **Task 9:** Replaced the placeholder `WorkbenchPage` with a Konva-based rooftop workbench that restores saved edits, renders the RGB background, colors panels by annual yield, and exposes the quantity slider.
- **Task 10:** Added `hooks/usePanelState.ts`, `components/workbench/PanelLayer.tsx`, and `components/workbench/PanelRect.tsx` to manage panel selection, drag, rotation, delete, overlap rejection, and live summary metrics.
- **Task 10:** Wired drag-end and rotation changes to `POST /api/locations/:locationId/panels/recompute`, with 300ms debouncing for rotation and AABB/image-boundary checks before recompute requests are sent.
- **Task 11:** Wired "Save & Continue" to `PATCH /api/projects/:id/layout`, disabled save while layout mutations are active, and added the dashboard return path.
- **Build:** `node node_modules/typescript/bin/tsc -b frontend`, `npm run build --workspace=frontend`, and root `npm run build` all pass after the Workbench changes.

## [06/03/26] - Phase 2 Tasks 1 to 8: Frontend Auth, Dashboard, MapPage

- **Task 1:** Added `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` to root `.env` and `.env.example`. Configured Vite `envDir` to read from monorepo root. Created Supabase client singleton (`lib/supabase.ts`). Installed `@supabase/supabase-js`.
- **Task 2:** Created `AuthProvider` + `useAuth()` hook (`hooks/useAuth.tsx`) with `signIn`, `signUp`, `signOut`, session state, and `onAuthStateChange` listener. Created `ProtectedRoute` component. Updated `App.tsx` to nest protected routes. Wrapped app in `AuthProvider` in `main.tsx`.
- **Task 3:** Created typed API client layer: `api/client.ts` (auto-injects Bearer token from Supabase session), `api/locations.ts`, `api/projects.ts`, `api/tariff.ts`. All typed against `@shared/types`. `ProjectResponse` type defined locally for Prisma response shape.
- **Task 4:** Installed 9 shadcn/ui components (button, input, label, card, dialog, separator, badge, slider, sonner). Set up Tailwind v4 CSS theme variables in `index.css` for shadcn compatibility (oklch neutral palette).
- **Task 5:** Implemented `SignInPage` - email/password form, calls `signIn()`, navigates to dashboard, inline error display, redirects if already authenticated.
- **Task 6:** Implemented `SignUpPage` - email/password form, calls `signUp()`, shows "Check your email" confirmation card. Implemented `LandingPage` â€” hero section with CTA buttons, auto-redirects authenticated users.
- **Task 7:** Implemented `DashboardPage` - TanStack Query project list, project cards with status badges, click-to-navigate by status, "New Project" dialog (name input â†’ navigate to `/project/new/map` with name in Router state), empty state, sign out.
- **Task 8:** Installed `@types/google.maps`. Created `useGoogleMaps` hook (singleton Loader). Implemented `MapPage` - Google Maps with satellite view, Autocomplete restricted to Malaysia, place marker, "Confirm Location" card, `POST /api/locations/resolve` (without `projectId` for new projects), polls `GET /api/locations/:id/status` every 2s, on ready -> `POST /api/projects` â†’ navigate to workbench, error/retry flow. Handles both new (`/project/new/map`) and existing project paths.
- **Phase 1.1 close-out:** Ticked remaining Phase 1.1 Task 2 items - `projectId` optional contract confirmed, validators already match, frontend resolve call implements both paths correctly.
- **Build:** `npm run build` passes (shared -> prisma -> backend -> frontend). Added `"types": ["vite/client", "google.maps"]` to frontend tsconfig.

## [05/03/26] - Phase 1.1: Backend Hardening (Post-QA Audit)

- Added `asyncHandler` middleware and wrapped async handlers in `locations.ts`, `projects.ts`, and `tariff.ts` so thrown async errors flow to global `errorHandler`.
- Added runtime parser (`buildingInsightsService.ts`) for `solarPotential.panelWidthMeters`, `panelHeightMeters`, `panelCapacityWatts` with new unit tests.
- Updated `POST /api/locations/:locationId/panels/recompute` to return `panelId` in response and to fail safely when building-insights shape is invalid.
- Updated shared API types: `ResolveLocationRequest.projectId` is optional (matches current backend contract); `FluxRecomputeResponse` now includes `panelId`.
- Expanded `tests/smoke/smoke-authz.sh` with cross-link coverage: User A creating project with User B `locationId` is asserted as allowed under shared-cache policy.
- Added curl connect/operation timeouts in smoke script to avoid hanging runs.
- Added backend health preflight + URL fallback logic in smoke script (`localhost`, `127.0.0.1`, WSL Windows-host IP) to fail fast when backend is unreachable.
- Documented shared immutable `Location` cache policy and endpoint contract notes in `TRD.md` (new section 11).

## [05/03/26] - Test Script Organization: Root `tests/` Directory

- Created root `tests/smoke/` folder and moved ownership smoke script to `tests/smoke/smoke-authz.sh`.
- Updated smoke script env loading to resolve `.env` from project root after relocation (with `ENV_FILE` override support).

## [05/03/26] - Supabase Bucket Creation

- ZJ created bucket on Supabase project with `{"name":"geotiffs"}` success response.

## [05/03/26] - Phase 1: Backend â€” Auth, API Endpoints, Solar API Pipeline

- Implemented Supabase client singleton (`config/supabase.ts`) and Prisma client singleton (`config/prisma.ts`).
- Implemented auth middleware (`middleware/auth.ts`) â€” JWT verification via `supabase.auth.getUser()`, Express Request type augmentation.
- Implemented reusable Zod validate middleware (`middleware/validate.ts`) and validation schemas for all endpoints.
- Implemented Project CRUD: 5 endpoints (create, list, get, save layout, save analysis) with ownership enforcement.
- Implemented Tariff endpoint (`GET /api/tariff/config`, public) and Prisma seed script with RP4 tariff data (rates, thresholds, 16-bracket EEI table from Knowledge Vault).
- Implemented Solar API fetch pipeline: `fetchBuildingInsights`, `fetchDataLayers`, haversine radius calculation, panel enrichment with deterministic IDs, GeoTIFF download + Supabase Storage upload (5 layers), RGBâ†’PNG conversion with sharp.
- Implemented Location endpoints: `POST /resolve` (cache check + async pipeline), `GET /:id/status`, `GET /:id/data` (signed URL for RGB).
- Implemented coordinate transform utilities: `setupGeoTransform`, `latLngToPixel`, `pixelToLatLng`, `metersToPixels` (ported from Python prototype using proj4 + geotiff.js).
- Implemented panel geometry utilities: `rotatePoint`, `getRotatedCorners`.
- Implemented flux sampler: `pointInPolygon` (ray-casting), `calculateAverageFlux`, `computeMonthlyEnergy` (12-band sampling).
- Implemented flux recomputation endpoint: `POST /api/locations/:locationId/panels/recompute` â€” full pipeline from lat/lng to monthly kWh.
- Added `tariffVersion` unique constraint to Prisma schema + migration.
- Wrote 18 unit tests (3 test files) for geo transforms, panel geometry, and flux sampler â€” all passing.
- Added `prisma.seed` config to `backend/package.json`.

## [05/03/26] - Platform Migration: Render â†’ Heroku

- Switched deployment platform from Render (free tier) to Heroku (GitHub Student credits, $13/mo).
- Added `Procfile` at repo root â€” single web dyno runs Express, which serves the built frontend.
- Added `heroku-postbuild`, `build`, and `start` scripts to root `package.json`.
- Updated `env.ts` to accept Heroku's dynamic `PORT` env var (falls back to `BACKEND_PORT` for local dev). Added `NODE_ENV` to schema.
- Updated `app.ts` to serve `frontend/dist` as static files in production, with a catch-all for React Router.
- Updated `server.ts` to use unified `env.port`.
- Updated `.env.example` with `PORT` and `NODE_ENV` comments.
- Updated all docs: TRD.md, PRD.md, ROADMAP.md â€” replaced Render references with Heroku.

## [03/03/26] - Phase 0: Infrastructure Setup

- Created Supabase project (PostgreSQL, Auth, Storage); filled `.env` with real credentials.
- Fixed `env.ts` dotenv path â€” used `import.meta.url` + `fileURLToPath` to resolve root `.env` from `backend/src/config/`.
- Added `DIRECT_URL` to `prisma/schema.prisma` for migration support; ran first migration (`20260303105217_init`) â€” all three models created in Supabase.
- Fixed frontend Tailwind conflict â€” removed legacy PostCSS plugin config; `@tailwindcss/vite` handles processing.
- Added `db:migrate`, `db:seed`, `dev:backend`, `dev:frontend` scripts to root `package.json`.
- Verified dev server: backend responds `{"status":"ok"}` on `GET /api/health`; frontend renders placeholder on `:5173`.

## [03/03/26] - Phase 0: Project Scaffolding

- Scaffolded full monorepo structure with npm workspaces: `shared`, `backend`, `frontend`.
- Root: added `tsconfig.json`, `.eslintrc.cjs`, `.env.example`; updated `package.json` with workspaces and `dev` script (concurrently).
- Shared: created `@shared/types` package with `PanelEdit`, `LocationStatus`, `ProjectStatus`, and all API request/response types.
- Backend: Express app with CORS, JSON parsing, health route (`GET /api/health`), placeholder route stubs for locations/projects/tariff, Zod env validation, global error handler.
- Prisma: full schema with `Location`, `Project`, `TariffConfig` models and enums.
- Frontend: Vite + React + Tailwind + TanStack Query + React Router. All 7 placeholder pages wired to routes. shadcn/ui config (`components.json`) and `cn()` utility set up. Dev proxy to backend on `/api`.
