# TEST - AGENT ONLY

## [08/03/26] - Phase 2.5 Location Cache Smoke Test

- Scenario: Validate the new location-cache smoke script structure before using a live Solar API-backed coordinate.
- Steps: Ran `bash -n tests/smoke/smoke-location-cache.sh` to verify shell syntax and checked the script flow against the existing backend auth/project/location contracts.
- Result: Pass (shell syntax validation succeeded; live end-to-end execution intentionally not run from this environment because it requires a chosen test coordinate, a running backend, and may consume a real Solar API cache miss).

## [07/03/26] - Phase 2.4 Workbench Rendering Alignment

- Scenario: Validate the prototype-aligned Workbench transform path using reference GeoTIFF metadata rather than the building bounding box approximation.
- Steps: Ran `npm run build --workspace=backend`, `npm run build --workspace=frontend`, `npm exec --workspace=backend -- vitest run`, `npm run test --workspace=frontend`, and a one-off numeric sanity check against the latest stored `rgb.tif` + `buildingInsightsJson`.
- Result: Pass (backend build passed; frontend build passed; backend Vitest: 5 files / 24 tests passed; frontend Vitest: 3 files / 7 tests passed; latest location panels projected to `x=183.64..235.65`, `y=181.25..361.94` within a `439x439` image).

## [07/03/26] - Phase 2.3 Workbench Bootstrap + Runtime Logging

- Scenario: Validate the Workbench bootstrap fix and the new runtime observability pass across frontend and backend.
- Steps: Ran `npm run build --workspace=backend`, `npm run build --workspace=frontend`, `npm exec --workspace=backend -- vitest run`, and `npm run test --workspace=frontend`.
- Result: Pass (backend build passed; frontend build passed; backend Vitest: 5 files / 23 tests passed; frontend Vitest: 3 files / 7 tests passed).

## [06/03/26] - Phase 2.2 MapPage Polling + Places Follow-up

- Scenario: Validate the manual-QA follow-up fixes for new-project location polling, modern Google Places initialization, and the backend ownership regression.
- Steps: Ran `npm exec --workspace=backend -- vitest run`, `npm run test --workspace=frontend`, `npm run build --workspace=backend`, and root `npm run build`.
- Result: Pass (backend Vitest: 5 files / 23 tests passed; frontend Vitest: 3 files / 7 tests passed; backend build passed; root monorepo build passed).

## [06/03/26] - Phase 2.1 Frontend QA Fix Validation

- Scenario: Validate the Phase 2 QA-fix pass for Page 1 search/recovery, Workbench interaction polish, and new frontend unit tests.
- Steps: Ran `npm run test --workspace=frontend`, `npm run build --workspace=frontend`, and root `npm run build`.
- Result: Pass (frontend Vitest: 3 files / 7 tests passed; frontend build passed; root monorepo build passed).

## [05/03/26] - Phase 1.1 Test Rerun (User Environment)

- Scenario: Rerun full Phase 1.1 validation suite in user's WSL environment after tsconfig + dependency fixes.
- Steps: Ran `npm run build --workspace=backend`, `npm exec --workspace=backend -- vitest run`, `bash tests/smoke/smoke-authz.sh`.
- Result: Pass (all three checks passed).

## [05/03/26] - Phase 1.1 Hardening Validation

- Scenario: Validate post-QA hardening changes (async route error flow + runtime panel-spec guards + parser tests).
- Steps: Ran `npm exec --workspace=backend -- vitest run`.
- Result: Pass (7 files, 39 tests).

- Scenario: Run updated `tests/smoke/smoke-authz.sh` including cross-link policy case.
- Steps: Executed script from this environment after starting backend in a Windows process.
- Result: Fail in this environment. Backend startup from this Windows automation shell failed (`tsx` not found), so smoke requests timed out. Requires rerun in user's normal WSL setup where `npm run dev:backend` works.

## [05/03/26] - Phase 1 Geo + Flux Unit Tests

- Scenario: Validate coordinate transforms, panel geometry, and flux sampling math.
- Steps: Ran `npx vitest run backend/src/geo/` â€” 3 test files, 18 tests.
- Result: Pass (18/18). Tests cover pointInPolygon (inside/outside/rotated), calculateAverageFlux (uniform/non-uniform/clipping/empty), latLngToPixel/pixelToLatLng roundtrip, metersToPixels, rotatePoint (0Â°/90Â°/180Â°), getRotatedCorners (0Â°/90Â°/45Â°).



