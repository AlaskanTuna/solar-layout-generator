# Phase 2 Audit

**Reviewer:** QA (GitHub Copilot)
**Date:** 06/03/26
**Scope:** Phase 2 frontend — Auth UI, Dashboard, MapPage, WorkbenchPage — assessed against PLAN.md Phase 2 tasks 1–11, PRD FR-1/FR-2/FR-3/FR-10, and TRD §4–6.

---

## Verdict

- **Overall status:** Pass with issues
- **Summary:** All Phase 2 plan items are implemented and the code compiles cleanly (zero TS errors, 21 backend tests pass, frontend Vite build succeeds). Auth flow, dashboard, MapPage location resolve/poll, and WorkbenchPage canvas + panel interactions are structurally complete. Three issues found: one major (drag snap-back doesn't visually reset) and two minor (new-project flow fragility, rotation input edge case). None are blockers for QA signoff, but the major should be fixed before user-facing demo.

---

## Scope Checked

- **Auth flow:** `AuthProvider`, `ProtectedRoute`, `SignInPage`, `SignUpPage`, `LandingPage` — session management, route guarding, redirect behavior
- **API client layer:** `api/client.ts`, `api/locations.ts`, `api/projects.ts`, `api/tariff.ts` — token injection, typing, error handling
- **Dashboard flow:** `DashboardPage` — project list, status badges, click-to-navigate by status, "New Project" dialog, sign out
- **MapPage flow:** `MapPage`, `useGoogleMaps` — Google Maps init, Autocomplete (Malaysia), confirm location, resolve/poll, project creation, navigation to workbench
- **WorkbenchPage flow:** `WorkbenchPage`, `useWorkbenchData`, `usePanelState`, `PanelLayer`, `PanelRect`, `canvasTransforms`, `buildingInsights` — canvas setup, panel rendering, quantity slider, select, drag, rotate, delete, overlap detection, recompute, save layout, navigation to analysis
- **Navigation/routing:** `App.tsx` route tree, `ProtectedRoute` guard, all inter-page navigation
- **Backend regression:** 21 unit tests pass, `tsc --noEmit` clean
- **Shared types:** `@shared/types` alignment between frontend API layer and backend contracts
- **Build:** Full monorepo build succeeds

---

## Findings

### 1. Drag rejection doesn't visually snap the panel back to its original position

- **Severity:** Major
- **Area:** WorkbenchPage — `handlePanelDragEnd` + `PanelRect`
- **Reproduction steps:**
  1. Open workbench with a loaded project.
  2. Drag a panel so it overlaps another panel.
  3. Release the mouse.
- **Expected result:** Panel snaps back to its pre-drag position on the canvas.
- **Actual result:** `handlePanelDragEnd` in [WorkbenchPage.tsx](frontend/src/pages/WorkbenchPage.tsx#L210-L222) calls `isPlacementValid`, and if invalid, shows an error message and `return`s without calling `movePanel`. However, **Konva has already moved the `<Rect>` node to the new position on the canvas**. Since no state update occurs, React does not re-render the panel at its old coordinates — the panel stays visually at the rejected position until the next render cycle triggered by something else (e.g., selecting a different panel).
- **Notes / probable cause:** Konva drag events mutate the node position directly. On rejection, the handler must explicitly reset `event.target.x()` / `event.target.y()` back to the original pixel position, or trigger a state update that forces React/Konva to re-render. The current code only `return`s, leaving Konva's internal position stale.

### 2. New-project flow loses `projectName` on page refresh during processing

- **Severity:** Minor
- **Area:** MapPage — new project creation
- **Reproduction steps:**
  1. From dashboard, click "New Project", enter a name, click Continue.
  2. On MapPage, search and confirm a location.
  3. While the "Analyzing your rooftop..." spinner is active, refresh the browser.
- **Expected result:** The processing continues or the user is gracefully returned to dashboard.
- **Actual result:** `projectName` is stored in React Router `location.state` ([MapPage.tsx](frontend/src/pages/MapPage.tsx#L22)). On refresh, `location.state` is `null`, so `projectName` is `''`. When the location becomes `ready`, [MapPage.tsx](frontend/src/pages/MapPage.tsx#L65-L71) calls `createProject({ name: '', locationId })` — if the backend accepts an empty name, the project is created with no name. If it rejects (`name.min(1)`), the user sees a generic "Failed to create project" error with no recovery path.
- **Notes / probable cause:** Router state is ephemeral. A `sessionStorage` checkpoint for `projectName` before navigation, or persisting the project record before resolve, would fix this. Not blocking since the scenario requires deliberate mid-flow refresh, but it will confuse users if encountered.

### 3. Rotation input allows values outside 0–359 range to trigger recompute

- **Severity:** Minor
- **Area:** WorkbenchPage — rotation input handler
- **Reproduction steps:**
  1. Select a panel in the workbench.
  2. Type `720` or `-45` in the "Rotate Panel" input.
- **Expected result:** Value is normalized before placement validation and recompute.
- **Actual result:** `handleRotationInput` in [WorkbenchPage.tsx](frontend/src/pages/WorkbenchPage.tsx#L249-L258) normalizes via `((value % 360) + 360) % 360`, which correctly wraps to 0–359. However, the `<Input>` element has `min={0} max={359}` HTML attributes that are only enforced by native browser step buttons, not by manual typing. The JS handler works correctly regardless, so the recompute result is correct, but the displayed input value may briefly show `720` before the next render cycle normalizes it because `rotatePanel` stores the normalized value. This is cosmetic — the math is safe.
- **Notes:** Low priority. The native `min`/`max` HTML constraint on `type="number"` doesn't prevent manual entry. Not a functional bug since `handleRotationInput` normalizes.

---

## Confirmed Working

- **Auth flow:** `AuthProvider` subscribes to `onAuthStateChange`, `ProtectedRoute` redirects to `/sign-in` when unauthenticated, auth pages redirect to `/dashboard` when already signed in.
- **API client:** `apiFetch` injects Bearer token from current Supabase session, handles non-OK responses with structured `ApiError`.
- **Dashboard:** TanStack Query fetches project list, cards render with status badges, `projectRoute()` correctly maps `draft` → map, `layout_saved` → workbench, `analysis_saved` → analysis. "New Project" dialog navigates to `/project/new/map` with name in Router state.
- **MapPage:** Google Maps loads with satellite view, Autocomplete restricted to Malaysia (`componentRestrictions: { country: 'my' }`), `AdvancedMarkerElement` placed on selection. "Confirm Location" triggers resolve. Polling via TanStack Query `refetchInterval: 2000` on `processing` status. On `ready`, creates project (new) or navigates directly (existing). `failed` state shows error with retry.
- **MapPage existing project path:** Loads project, checks location status, redirects to workbench if already ready.
- **WorkbenchPage data loading:** `useWorkbenchData` chains project → locationId → `getLocationData`, `parseBuildingInsights` does full runtime validation.
- **Canvas setup:** `useStageSize` responsively scales the satellite image to fit the viewport. `createCanvasGeo` derives meters-per-pixel from haversine distance across the bounding box.
- **Panel rendering:** Panels rendered as Konva `Rect` with `offsetX`/`offsetY` centering, color-coded by relative yield (red-to-green gradient). Selected panel highlighted with white stroke + larger shadow.
- **Quantity slider:** Min 4, max `maxArrayPanelsCount`. Panels sorted by yield (highest first), slider hides lowest-yield panels. Count displayed in toolbar.
- **Panel select:** Click/tap selects panel. Sidebar shows panel ID, annual yield, rotation.
- **Panel drag:** `dragBoundFunc` constrains panel within stage bounds. `onDragEnd` converts pixel → lat/lng, validates placement, calls `movePanel` then `recomputeFlux`.
- **Panel rotation:** Input fires `rotatePanel` immediately for visual feedback, debounces recompute by 300ms. Rotation validated against overlap/bounds before applying.
- **Panel delete:** Sets `deleted: true` in state, panel removed from `visiblePanels`.
- **Overlap detection:** AABB-based collision check against all other visible panels.
- **Recompute:** Calls `POST /api/locations/:locationId/panels/recompute`, updates `monthlyEnergyDcKwh` on success, rolls back on failure.
- **Save & Continue:** `saveLayout(projectId, { editedLayout: serializeLayout() })` → navigate to `/project/:id/analysis`. Button disabled while saving or while a recompute is pending.
- **Layout serialization:** `serializeLayout()` correctly classifies panels as `kept`/`moved`/`deleted` using epsilon comparisons against original positions, includes all panels (not just visible), satisfies `PanelEdit[]` type.
- **Layout restoration:** `usePanelState` reads `project.editedLayout`, `parsePanelEdits` safely validates the JSON array, and initializes state with saved centers/rotations/energy/deleted status.
- **Navigation to Analysis:** Works — navigates to `/project/:id/analysis` which renders the placeholder `<h1>Analysis</h1>`.
- **Back to Dashboard:** Link present and functional in workbench sidebar.
- **Backend regression:** 21/21 tests pass, zero TS errors.
- **Build:** Full monorepo `tsc -b` and Vite build succeed.

---

## Known Boundaries

- **AnalysisPage is a placeholder** — renders `<h1>Analysis</h1>`. Routing to it works. Not a Phase 2 deliverable.
- **Workbench placement validation is image-bounds + AABB overlap only** — not true roof-mask boundary. Documented as Phase 3 task (PLAN.md §12).
- **Monthly energy consistency for untouched panels** — panels that were not moved/rotated still use `yearlyEnergyDcKwh` from buildingInsights, not 12-month breakdown. Phase 3 follow-up tracked in PLAN.md §12.
- **AABB overlap detection is approximate** — uses axis-aligned bounding boxes, which can false-positive for rotated panels at certain angles. Accepted for Phase 2 MVP per plan.
- **Sonner toast component installed but not wired** — `sonner.tsx` is in `components/ui/` but toast notifications are not used anywhere in Phase 2 pages (inline messages used instead). Not a bug, just unused.

---

## Risks / Gaps

- **No frontend unit tests** — no test files exist under `frontend/src/`. Canvas transform math (`canvasTransforms.ts`), building insights parsing (`buildingInsights.ts`), and panel state logic (`usePanelState.ts`) are non-trivial and untested. Risk: regressions introduced during Phase 3 won't be caught.
- **Live E2E not verified in this review** — code review only; the full user flow was not executed against a running backend + Supabase + Google Maps API. Risk: runtime integration issues (e.g., CORS, signed URL expiry, Google Maps API key restrictions) would not surface.
- **Google Maps API key exposed to client** — `VITE_GOOGLE_MAPS_API_KEY` is bundled into the frontend build. This is standard for Maps JS API but should have HTTP referrer restrictions configured in Google Cloud Console. Not verified.
- **`mapId: 'solar-layout-map'` requires Cloud Maps configuration** — `AdvancedMarkerElement` requires a Map ID created in the Google Cloud Console. If not configured, the marker won't render. This is a deployment prerequisite, not a code bug.
- **No loading/error boundary at `<App>` level** — if `AuthProvider` or any top-level query throws, there's no React error boundary to catch it. Users would see a white screen.

---

## Recommendation

**Pass with issues — fix Finding #1 before user-facing demo, then proceed to Phase 3.**

- **Finding #1 (drag snap-back)** is the only issue that produces visibly incorrect behavior during normal panel editing. Fix is localized to `handlePanelDragEnd` / `PanelRect` — either reset `event.target` position on rejection, or trigger a forced re-render.
- **Finding #2 (project name loss on refresh)** is edge-case and can be deferred to Phase 3 polish.
- **Finding #3 (rotation input cosmetic)** is cosmetic, no functional impact.
- **Frontend unit tests** are recommended before Phase 3 adds complexity (billing engine, mask validation), but are not blocking.

**Assigned follow-ups:**

| #   | Finding / Gap                             | Action                                                                     | Assigned To | When                        |
| --- | ----------------------------------------- | -------------------------------------------------------------------------- | ----------- | --------------------------- |
| 1   | Drag snap-back visual glitch              | Reset Konva node position on placement rejection                           | `PG`        | Before next demo            |
| 2   | Project name loss on refresh              | Persist `projectName` in `sessionStorage` or create project before resolve | `PG`        | Phase 3 polish              |
| 3   | Rotation input cosmetic                   | Low priority — clamp or hide raw input value                               | `PG`        | Phase 3 polish              |
| 4   | Frontend unit tests                       | Add tests for `canvasTransforms`, `buildingInsights`, `usePanelState`      | `PG`        | Before Phase 3 feature work |
| 5   | Google Maps API key referrer restrictions | Verify HTTP referrer restrictions in Google Cloud Console                  | `ZJ`        | Before deployment           |
| 6   | React error boundary                      | Add top-level error boundary in `App.tsx` or `main.tsx`                    | `PG`        | Phase 3                     |
