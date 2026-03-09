# Phase 3.1 QA Audit

**Date:** 10 Mar 2026
**Reviewer:** QA Agent (Antigravity)
**Scope:** Phase 3 tasks 1–11 code review — correctness, edge cases, contract alignment, behavioral regressions
**Files reviewed:** 18 source files across `backend/src/routes`, `backend/src/services`, `backend/src/validators`, `frontend/src/pages`, `frontend/src/hooks`, `frontend/src/lib`, `frontend/src/api`, `shared/index.ts`

---

## Verdict: **Approve with Comments**

No blocking correctness bugs found. The billing engine matches the TRD §6.3 spec, batch recompute is solid, and the save-gate logic is well implemented. The issues below are improvement items ordered by severity; none should block Phase 3.1 acceptance, but S1 and S2 items should be resolved before production deployment.

---

## Task Coverage Matrix

Every Phase 3 PLAN.md task mapped to its audit assessment(s):

| #   | PLAN.md Task                         | Findings             | Verdict             |
| --- | ------------------------------------ | -------------------- | ------------------- |
| 1   | Batch Recompute Endpoint             | S3.7                 | ✅ Pass             |
| 2   | Workbench Batch Recompute on Save    | S2.1, S3.2           | ✅ Pass             |
| 3   | Roof Mask Boundary                   | S3.5                 | ✅ Pass             |
| 4   | React Error Boundary                 | S3.1                 | ✅ Pass             |
| 5   | TariffConfig Defaults                | S1.4, S3.8           | ⚠️ Pass w/ comment  |
| 6   | NEM Billing Engine                   | S3.9                 | ✅ Pass             |
| 7   | Billing Engine Unit Tests            | S3.10                | ✅ Pass             |
| 8   | AnalysisPage — Data Loading + Inputs | S2.4, S3.3, S3.6     | ✅ Pass             |
| 9   | AnalysisPage — Results Display       | S1.3, S2.2, S2.3     | ⚠️ Pass w/ comments |
| 10  | PDF Export                           | S3.4, S1.1 (related) | ⚠️ Pass w/ comment  |
| 11  | Save Analysis + Navigation           | S1.1, S1.2, S3.3     | ⚠️ Pass w/ comments |

---

## Findings

### S1 — Medium Severity

#### S1.1 · `saveAnalysis` returns a bare Project without `location` include — PDF "Location" may show `N/A`

**File:** [projectService.ts](file:///d:/CS/fyp-folder/solar-layout-generator/backend/src/services/projectService.ts#L38-L54)
**Tasks:** 10, 11
**Impact:** AnalysisPage caches the `saveAnalysis` response via `queryClient.setQueryData`, overwriting the prior `getProject` result that _did_ include `location`. The PDF report section then accesses `projectQuery.data.location` and finds nothing → renders `Location: N/A`.

```diff
 // projectService.ts — saveAnalysis
  return prisma.project.update({
    where: { id: projectId },
    data: { ... },
+   include: { location: true }
  })
```

The same issue exists for `saveLayout` (line 29), but it's less visible because the user navigates away immediately after save.

---

#### S1.2 · `saveAnalysisSchema` allows fully unstructured `analysisConfig` and `analysisResults`

**File:** [projects.ts (validators)](file:///d:/CS/fyp-folder/solar-layout-generator/backend/src/validators/projects.ts#L23-L26)
**Task:** 11
**Impact:** A malformed payload (e.g. `{ analysisConfig: "garbage" }`) passes Zod validation because `z.record(z.unknown())` accepts any object. On revisit, `parseSavedAnalysisConfig` silently returns `null` for invalid fields, which means the user sees default values instead of their saved ones, with no warning that the saved data was malformed.

**Recommendation:** Add at minimum a partial shape check for the fields the frontend actually saves:

```ts
const analysisConfigSchema = z
  .object({
    monthlyConsumptionKwh: z.number(),
    connectionPhase: z.enum(['single', 'three']),
    systemCostRm: z.number(),
    afaRateSenPerKwh: z.number(),
    systemKwp: z.number()
  })
  .passthrough()
```

---

#### S1.3 · Threshold warnings check `retailWaiver` but should also check `afaWaiver` if they differ

**File:** [analysis.ts](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/lib/analysis.ts#L131-L147)
**Task:** 9
**Impact:** `buildThresholdWarnings` references `thresholds.retailWaiver` in its warning text mentioning "retail charge, AFA, and SST are waived." This is correct if `retailWaiver === afaWaiver === sstExemption`, which is currently the case in the seed data (all 600 kWh). However, the TRD models them as separate thresholds. If the seed ever diverges, the warning would be misleading.

**Recommendation:** Either: (a) add separate warning branches for AFA and SST thresholds, or (b) add a code comment noting the assumption and a runtime assertion that the three thresholds match.

---

#### S1.4 · `tariff.ts` hardcodes fallback defaults when `config.defaults` is `null`

**File:** [tariff.ts](file:///d:/CS/fyp-folder/solar-layout-generator/backend/src/routes/tariff.ts#L23-L28)
**Task:** 5
**Impact:** If `config.defaults` is `null` (e.g. database seeded before the `defaults` field was added), the endpoint falls back to inline hardcoded values (`nemCapSinglePhaseKw: 5`, `systemCostPerKwp: 4500`, etc.). This violates the design principle that all tariff parameters come from the database seed, not source code. The risk: if the seed values are updated but the fallback is forgotten, old deployments silently use stale defaults without warning.

**Recommendation:** Either: (a) make `defaults` a required non-null column in the schema and fail loudly if null, or (b) log a warning when the fallback is used so operators notice.

---

### S2 — Low Severity

#### S2.1 · `serializedLayout` data race on batch save

**File:** [WorkbenchPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/WorkbenchPage.tsx#L443-L504)
**Task:** 2
**Impact:** In `handleSave`, `serializeLayout()` is called _before_ the batch recompute, then `nextLayout` is built by merging batch results into this serialized snapshot. But `updatePanelEnergies(batchResponse.results)` is called on line 481 _between_ the two — this updates React state but the `nextLayout` being saved was already derived from the earlier `serializedLayout`. This means the saved layout correctly includes fresh energy (because it's explicitly merged from `energyByPanelId`), but the local React state and the persisted layout could briefly disagree before navigation. Since the user navigates away immediately, this is benign, but it is a subtle data ordering worth being aware of.

**Recommendation:** Consider removing the `updatePanelEnergies` call during save since navigation follows immediately and the intent is already captured in `nextLayout`.

---

#### S2.2 · "Net Import" column label in month-by-month table actually shows `billableKwh`

**File:** [AnalysisPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/AnalysisPage.tsx#L672-L686)
**Task:** 9
**Impact:** The table header says "Net Import", but the value rendered is `month.billableKwh`. These are different: `Net Import = consumption − generation` (can be negative), while `billableKwh = netImport − creditUsed` (always ≥ 0). The column label is misleading.

**Recommendation:** Either:

- Rename the header to "Billable kWh", or
- Add a separate column for true net import (`month.consumptionKwh - month.generationKwh`).

---

#### S2.3 · NEM bill breakdown in "With Solar" section omits AFA, EEI, Retail, RE Fund line items

**File:** [AnalysisPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/AnalysisPage.tsx#L610-L650)
**Task:** 9
**Impact:** The "Without Solar" breakdown shows all 8 bill components, but the "With Solar" side only shows 4 (energy, capacity, network, SST) plus NEM-specific fields (billableKwh, credit, etc.). Users cannot see whether AFA, retail, or EEI are being waived in the NEM bill. This is a display gap, not a correctness issue — the `nemBill.total` is correct.

**Recommendation:** Add the missing line items (retail, AFA, EEI rebate, RE Fund) to the "With Solar" breakdown panel.

---

#### S2.4 · AFA input allows negative values without warning

**File:** [AnalysisPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/AnalysisPage.tsx#L416-L425)
**Task:** 8
**Impact:** The AFA input has no `min` constraint (unlike consumption and system cost which have `min={0}`). A user could enter a negative AFA rate, producing nonsensical results.

**Recommendation:** Add `min={0}` or surface a validation message when negative.

---

### S3 — Informational (✅ Pass)

#### S3.1 · Error boundary wrapping order is correct

**File:** [main.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/main.tsx)
**Task:** 4
**Observation:** `AppErrorBoundary` wraps everything including `QueryClientProvider`, `BrowserRouter`, and `AuthProvider`. This is the right layering — root-level throws are caught. Fallback UI offers "Reload" and "Return to Dashboard" actions. ✅

---

#### S3.2 · Batch recompute save-gate is well implemented

**File:** [WorkbenchPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/WorkbenchPage.tsx#L443-L503)
**Task:** 2
**Observation:** Save is correctly blocked when batch recompute fails or returns incomplete (< 12 months) for any panel. A user-visible error is shown and the button becomes re-clickable. ✅

---

#### S3.3 · Saved analysis restore works correctly

**Files:** [analysis.ts](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/lib/analysis.ts#L71-L89), [AnalysisPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/AnalysisPage.tsx#L166-L178)
**Tasks:** 8, 11
**Observation:** The `initializedProjectIdRef` pattern ensures saved config is only restored once per project load, avoiding reactive loops. `parseSavedAnalysisConfig` handles missing/invalid fields gracefully. ✅

---

#### S3.4 · PDF export filename follows spec

**File:** [AnalysisPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/AnalysisPage.tsx#L68-L71)
**Task:** 10
**Observation:** `buildPdfFileName` produces `Solar_Analysis_{sanitizedName}_{YYYY-MM-DD}.pdf` per TRD spec. Special characters are sanitized. ✅

---

#### S3.5 · Roof mask boundary enforcement uses correct coordinate space

**Files:** [canvasTransforms.ts](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/lib/canvasTransforms.ts#L137-L172), [WorkbenchPage.tsx](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/pages/WorkbenchPage.tsx#L324-L337)
**Task:** 3
**Observation:** The mask check uses a separate `maskGeo` + `maskPanelDimensions` computed from the mask's own GeoTIFF metadata rather than the display canvas. `isPolygonInsideRasterMask` properly rejects placements where any in-polygon pixel has `mask = 0`. ✅

---

#### S3.6 · `connectionPhase` does not affect billing computation directly

**Task:** 8
**Observation:** The `connectionPhase` input is used only for the NEM capacity cap warning. The billing engine does not vary rates by phase, which is correct for TNB domestic tariff. ✅

---

#### S3.7 · Batch recompute endpoint is correctly optimized

**File:** [locations.ts](file:///d:/CS/fyp-folder/solar-layout-generator/backend/src/routes/locations.ts#L263-L319)
**Task:** 1
**Observation:** The batch endpoint downloads the GeoTIFF once, pre-reads all 12 raster bands via `preloadFluxRasters`, then loops through panels without additional I/O. Auth, Zod validation, and error handling (missing location, missing flux, invalid insights) are all present. Response shape matches `FluxRecomputeBatchResponse` from shared types. ✅

---

#### S3.8 · TariffConfig defaults field and seed are correctly wired

**Files:** [tariff.ts](file:///d:/CS/fyp-folder/solar-layout-generator/backend/src/routes/tariff.ts), [shared/index.ts](file:///d:/CS/fyp-folder/solar-layout-generator/shared/index.ts#L94-L107)
**Task:** 5
**Observation:** `TariffConfigResponse` in shared types includes `defaults: TariffDefaults` with the 4 required fields (`nemCapSinglePhaseKw`, `nemCapThreePhaseKw`, `systemCostPerKwp`, `annualYieldPerKwp`). The tariff endpoint returns these from the database. The frontend `getTariffConfig()` client is type-aligned. One concern noted in S1.4 (hardcoded fallback). ✅ with caveat

---

#### S3.9 · NEM billing engine implementation is correct and complete

**File:** [billingEngine.ts](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/lib/billingEngine.ts)
**Task:** 6
**Observation:** The 10-step bill computation matches TRD §6.3 exactly: threshold-based energy charge, capacity, network, retail (waiver-gated), AFA (waiver-gated), EEI rebate (bracket lookup), pre-tax subtotal, RE Fund (exemption-gated), SST (exemption-gated), minimum charge floor. All amounts in RM, sen conversion internal. NEM credit carry-forward and December forfeiture are correct. `round2` is applied per line item matching real utility billing. ✅

---

#### S3.10 · Billing engine test suite is comprehensive

**File:** [billingEngine.test.ts](file:///d:/CS/fyp-folder/solar-layout-generator/frontend/src/lib/billingEngine.test.ts)
**Task:** 7
**Observation:** 43 test cases covering: 8 EEI bracket lookups, 12 `computeBill` golden cases (including 600/601 waiver boundary, 1500/1501 cliff, minimum charge, RE Fund exemption), 7 `computeNemMonth` scenarios (surplus, deficit, credit exhaustion, December forfeiture), 5 `runAnnualSimulation` invariants (baseline parity, credit carry, December forfeit, non-negative savings, min charge). Test config matches the seeded RP4-2025 tariff. KV rounding discrepancies (≤ 1 cent) are documented in-line. ✅

---

## Summary Table

| ID    | Severity | Task(s) | Category            | Description                                                    |
| ----- | -------- | ------- | ------------------- | -------------------------------------------------------------- |
| S1.1  | Medium   | 10, 11  | Correctness         | `saveAnalysis` response missing `location` → PDF shows `N/A`   |
| S1.2  | Medium   | 11      | Validation          | Unstructured `analysisConfig` schema allows silent data loss   |
| S1.3  | Medium   | 9       | Edge case           | Threshold warning assumes equal waiver/exemption thresholds    |
| S1.4  | Medium   | 5       | Correctness         | Tariff endpoint hardcodes fallback defaults when DB field null |
| S2.1  | Low      | 2       | Data ordering       | `updatePanelEnergies` call during save is redundant            |
| S2.2  | Low      | 9       | Display             | "Net Import" column shows `billableKwh`, not true net import   |
| S2.3  | Low      | 9       | Display             | NEM bill breakdown omits AFA, retail, EEI, RE Fund line items  |
| S2.4  | Low      | 8       | Input validation    | AFA rate allows negative values                                |
| S3.1  | Info     | 4       | ✅ Correct          | Error boundary layering                                        |
| S3.2  | Info     | 2       | ✅ Correct          | Batch recompute save-gate                                      |
| S3.3  | Info     | 8, 11   | ✅ Correct          | Saved analysis restore                                         |
| S3.4  | Info     | 10      | ✅ Correct          | PDF filename format                                            |
| S3.5  | Info     | 3       | ✅ Correct          | Roof mask coordinate space                                     |
| S3.6  | Info     | 8       | ✅ Correct          | Phase-based billing behavior                                   |
| S3.7  | Info     | 1       | ✅ Correct          | Batch endpoint optimized (single GeoTIFF load)                 |
| S3.8  | Info     | 5       | ✅ Correct (caveat) | TariffConfig defaults wired end-to-end                         |
| S3.9  | Info     | 6       | ✅ Correct          | Billing engine matches TRD §6.3                                |
| S3.10 | Info     | 7       | ✅ Correct          | 43 unit tests, golden cases match KV                           |

---

## Reassessment — 10 Mar 2026 (Post PG Fix Pass)

PG implemented Phase 3.1 QA Audit Fixes (PLAN.md §3.1, tasks 1–7). All 8 actionable findings have been addressed and verified against the updated source files. Frontend tests increased from 44 → 47 (3 new threshold warning tests). Full build passes.

| Finding | Fix Applied                                                                                                                                                                                                                                | QA Verdict              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| S1.1    | `include: { location: true }` added to both `saveLayout` and `saveAnalysis` in `projectService.ts`                                                                                                                                         | ✅ Resolved             |
| S1.2    | Replaced `z.record(z.unknown())` with typed schemas: `billBreakdownSchema`, `monthlyBreakdownSchema`, `analysisConfigSchema`, `analysisResultsSchema` — all with `.passthrough()` for forward compatibility                                | ✅ Resolved             |
| S1.3    | `buildThresholdWarnings` now checks whether retail/AFA/SST thresholds match before combining into one message; emits separate warnings when they diverge                                                                                   | ✅ Resolved             |
| S1.4    | `console.warn` emitted when tariff `defaults` is null and fallback is used; functional response unchanged for backward compat                                                                                                              | ✅ Resolved             |
| S2.1    | Redundant `updatePanelEnergies()` call removed from the Workbench batch-save path                                                                                                                                                          | ✅ Resolved             |
| S2.2    | "Net Import" column now renders true `month.consumptionKwh - month.generationKwh` instead of `billableKwh`                                                                                                                                 | ✅ Resolved             |
| S2.3    | "With Solar" breakdown now shows all 8 bill components (energy, retail, capacity, AFA, network, EEI rebate, RE Fund, SST) alongside NEM credit fields                                                                                      | ✅ Resolved             |
| S2.4    | AFA input now uses `min={-10} max={10} step={0.01}` with helper text: _"Negative values represent a rebate."_ Original `min={0}` recommendation was incorrect — negative AFA is a valid rebate per billing engine tests (`afaRate: -2.77`) | ✅ Resolved (corrected) |

> **Phase 3.1 QA Status: All findings resolved.** Remaining step: manual frontend QA testing of the implemented changes before Phase 4 planning.
