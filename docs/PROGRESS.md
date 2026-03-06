# PROGRESS - AGENT ONLY

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



