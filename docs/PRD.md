# Product Requirements Document (PRD)

## Solar Layout Generator — Web-Based Solar Panel Layout Assessment Tool

> **Version:** 1.0 · **Status:** Draft · **Last Updated:** 2026-03-05
> **Source:** Derived from the FYP Project Proposal (`fyp-project-proposal.md`)

---

## 1. Problem Statement

Malaysian homeowners interested in rooftop solar have limited access to quick, data-driven preliminary assessments. Existing options are either manual on-site surveys (expensive, slow) or generic online calculators (no roof-specific data). There is no tool that lets users see a proposed panel layout on _their actual rooftop_, interactively adjust it, and immediately understand the financial impact under Malaysia's NEM Rakyat 3.0 scheme.

## 2. Project Objectives

1. **Investigate** rooftop characteristics and solar energy potential using Google Solar API's geospatial data as a basis for reducing reliance on manual assessments.
2. **Design and develop** a web-based tool that auto-generates preliminary panel layouts, enables interactive modification, and incorporates Malaysian tariff and NEM parameters.
3. **Evaluate** the system's usability, accuracy, and effectiveness through user feedback and comparison with existing methods.

## 3. Target Users

| User Type     | Description                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| **Primary**   | Malaysian homeowners exploring rooftop solar installation                      |
| **Secondary** | Solar installers using the tool for quick preliminary assessments with clients |

**User Assumptions:** Non-technical; unfamiliar with solar terminology; accessing via desktop browser (primary) or mobile (secondary).

## 4. User Workflow Overview

The core workflow follows a linear, three-page flow:

```
[Landing Page] → [Sign Up / Sign In] → [Dashboard]
                                            ↓
                                    [Create New Project]
                                            ↓
                                  Page 1: Enter Location
                                            ↓
                                  Page 2: Correction Workbench
                                            ↓
                                  Page 3: Solar Potential Analysis
```

---

## 5. Functional Requirements

### FR-1: Location Search & Building Confirmation

**Description:** User searches for their property address on an interactive map and confirms the target building.

**Acceptance Criteria:**

- [ ] User can search addresses via Google Maps Autocomplete
- [ ] Map centres on the search result
- [ ] User can confirm the building ("Is this your building?")
- [ ] Confirmed lat/lng are locked to the project record
- [ ] System shows a loading state while processing the location
- [ ] On success, user can proceed to the workbench
- [ ] On failure, user sees an error message and can search again

---

### FR-2: Automated Solar Layout Generation

**Description:** System automatically generates a suggested solar panel layout based on the building's rooftop data from the Google Solar API.

**Acceptance Criteria:**

- [ ] Panels are positioned according to Google Solar API's `solarPanels[]` data
- [ ] Each panel is enriched with a unique ID (`panel_0`, `panel_1`, ...)
- [ ] Panels are ordered by yield (highest-yield first)
- [ ] Panel count is controllable via a slider (min 4, max `maxArrayPanelsCount`)
- [ ] Panels are rendered on a satellite imagery canvas background

---

### FR-3: Interactive Layout Adjustment Workbench

**Description:** User can interactively modify the proposed layout by deleting, moving, or rotating panels.

**Acceptance Criteria:**

- [ ] User can delete individual panels
- [ ] User can drag panels in X/Y directions (constrained to mask boundary)
- [ ] User can rotate panels (0–360°)
- [ ] Panels must not overlap; overlapping placements are rejected (snap-back)
- [ ] On move/rotate, the system recomputes that panel's monthly energy values
- [ ] Total solar potential display updates immediately after each edit
- [ ] User can save the layout and proceed to analysis

---

### FR-4: Electricity Bill Savings & NEM Financial Projections

**Description:** System calculates monthly and yearly savings using Malaysian tariff rates and NEM Rakyat 3.0 rules.

**Acceptance Criteria:**

- [ ] 12-month NEM billing simulation runs entirely on the frontend
- [ ] Baseline bill (no PV) is computed for comparison
- [ ] NEM net import, credit balance, and billable kWh are computed per month
- [ ] Credit balance carries forward monthly and forfeits in December
- [ ] Savings = baseline bill − NEM bill per month
- [ ] Annual totals are aggregated: total savings, baseline cost, NEM cost, credits forfeited
- [ ] Simulation re-runs instantly when user changes any input (What-If reactivity)

---

### FR-5: Installation Cost Estimation & ROI

**Description:** System provides cost estimates and financial projections.

**Acceptance Criteria:**

- [ ] System cost auto-estimated as `systemKwp × RM 4,500/kWp` (user-editable)
- [ ] Payback period calculated as `systemCost / annualSavings`
- [ ] 10-year ROI calculated
- [ ] Carbon offset calculated using `carbonOffsetFactorKgPerMwh` from API

---

### FR-6: Panel Specification Guidance

**Description:** User can adjust panel wattage to see how it affects energy yield and costs.

**Acceptance Criteria:**

- [ ] Default panel wattage is from `buildingInsights.panelCapacityWatts`
- [ ] User can override panel wattage
- [ ] Changing wattage recalculates `systemKwp` and cost estimate
- [ ] All downstream projections (savings, payback, ROI) update accordingly

---

### FR-7: User-Editable Assumptions

**Description:** User can adjust simulation inputs to explore different scenarios.

**Acceptance Criteria:**

- [ ] Monthly electricity consumption (kWh) — default: 600
- [ ] Connection phase: Single-phase or Three-phase
- [ ] Panel wattage override
- [ ] Estimated system cost (RM)
- [ ] AFA rate (sen/kWh) — advanced toggle, hidden by default

---

### FR-8: Results Display

**Description:** System displays comprehensive energy and financial results.

**Acceptance Criteria:**

- [ ] Hero metrics: monthly savings (RM and %), annual savings, payback period, 10-year net benefit
- [ ] Comparison charts: monthly bill with vs. without solar; cumulative savings
- [ ] Month-by-month table: consumption, generation, billable kWh, credit balance, savings
- [ ] Bill breakdown: energy, capacity, network, retail, AFA, EEI, RE Fund, SST (baseline vs. NEM)
- [ ] Threshold warnings when NEM consumption crosses 600/1,000/1,500 kWh boundaries

---

### FR-9: Results Export (PDF)

**Description:** User can export a PDF summary report.

**Acceptance Criteria:**

- [ ] PDF includes: layout thumbnail, system summary, financial highlights, month-by-month breakdown
- [ ] PDF includes assumptions and disclaimers
- [ ] Generated client-side

---

### FR-10: Project Management (Dashboard)

**Description:** Authenticated users can create, view, and manage projects.

**Acceptance Criteria:**

- [ ] User can sign up / sign in (Supabase Auth)
- [ ] Dashboard lists saved projects
- [ ] User can create a new project
- [ ] User can return to a saved project's workbench or analysis page

---

## 6. Non-Functional Requirements

| ID    | Requirement        | Target                                                                                       |
| ----- | ------------------ | -------------------------------------------------------------------------------------------- |
| NFR-1 | **Multi-device**   | Desktop (primary), mobile browsers (secondary)                                               |
| NFR-2 | **Usability**      | Straightforward wording, tooltips, guided steps for non-technical users                      |
| NFR-3 | **Performance**    | Layout generation and financial projections within a few seconds                             |
| NFR-4 | **Transparency**   | Results clearly stated as preliminary; assumptions disclosed; on-site assessment recommended |
| NFR-5 | **Visual clarity** | Satellite maps, clear layout previews, simple visual indicators                              |

---

## 7. Scope Boundaries

### In Scope (MVP)

- Three-page workflow (Location → Workbench → Analysis)
- Google Solar API integration (`buildingInsights` + `dataLayers`)
- Interactive Konva.js canvas workbench
- NEM Rakyat 3.0 billing simulation (Malaysian tariff)
- PDF export (client-side)
- Supabase Auth, PostgreSQL, and Storage
- Deployment on Heroku (GitHub Student credits)

### Out of Scope (MVP)

- Multiple building/location comparisons
- Multi-panel-selection drag (single-selection only for MVP)
- Real-time electricity pricing / dynamic tariff updates
- Mobile-native apps
- Server-side PDF generation
- UI component tests (unit tests limited to billing engine and flux math)
- Monthly flux GeoTIFF layers used for visualisation (only used for computation)

---

## 8. Disclaimers (Product-Level)

All user-facing results must include:

- "These are preliminary estimates based on published tariff rates and NEM Rakyat 3.0 rules."
- All assumptions listed (tariff version, AFA rate, yield source, panel specifications).
- "A professional on-site assessment is recommended before making installation decisions."
