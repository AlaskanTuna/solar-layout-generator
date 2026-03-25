# User Acceptance Testing (UAT)

> **Purpose:** Logsheet to track timestamped feedback from targeted users (e.g. Malaysian homeowners) across RAD development cycles. Agents should review open feedback items before working on UI/UX tasks and update statuses after addressing them.

> **URL:** https://solar-layout-generator-8e2cfa5a38c7.herokuapp.com
> **Login:** `test2@email.com` / `test2`

## How to use this document

1. **Recording feedback:** After each UAT session, append a new `## Session` block below with the participant's details and a feedback table.
2. **Agent workflow:** Before starting UI/UX improvements, read all **Open** items. After resolving an item, change its status to `Resolved (DD/MM/YY)`.
3. **Severity levels:** Critical (blocks core workflow) / High (major usability issue) / Medium (improvement opportunity) / Low (cosmetic or minor).

## Entry format

```markdown
## Session: [DD/MM/YY] - Session Title

**Participant:** Name | Age | Role (e.g. Homeowner, Property Manager)

| #   | Page/Feature | Feedback               | Severity | Status |
| --- | ------------ | ---------------------- | -------- | ------ |
| 1   | PageName     | "Quoted user feedback" | High     | Open   |

**General Comments:** Free-form participant remarks.
```

---

<!-- Append UAT session entries below this line -->

## Session: 17/03/26 - UAT 1

**Participant:** Eric | 52 | Homeowner

| #   | Page/Feature            | Feedback                                                                                                         | Severity | Status |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | WorkbenchPage (general) | User got stuck — did not understand what the page is for, what the green shapes (panels) are, or what to do next | Critical | Open   |
| 2   | WorkbenchPage (panels)  | Panel objects on the canvas are not self-explanatory; no guidance on drag/rotate/delete interactions             | High     | Open   |
| 3   | WorkbenchPage (flow)    | No clear indication of the next step or how to proceed from the workbench to the analysis page                   | High     | Open   |

**General Comments:** User described feeling "blurry" on what to do. The workbench page currently provides no onboarding, tooltips, or contextual guidance for non-technical users. This directly conflicts with PRD NFR-2 (guided steps for non-technical users).

### HCI / UX Analysis

Eric's feedback maps to **three distinct HCI violations**, not just "missing instructions":

**1. Gulf of Execution (Don Norman) — #1 Critical**
The user cannot form an action plan because the page fails to communicate its _purpose_. Before a user can interact, they need a mental model: "This page is for adjusting which solar panels go on my roof." Without that framing, no amount of interactive polish helps. This is a **conceptual gap**, not a visual one.

**2. Missing Affordances & Signifiers (Don Norman) — #2 High**
The green rectangles lack _signifiers_ — visual cues that communicate "I am interactive." Per UX guidelines: interactive elements must provide hover feedback (`cursor-pointer`, subtle visual change) and look distinct from static content. Currently, panels look like static overlays on a map. A non-technical user has no reason to believe they can be dragged.

- **Do:** Change cursor on hover, add subtle highlight/shadow, show drag handles or a tooltip on first hover.
- **Don't:** Rely on the user to discover interactivity by accident.

**3. No Progressive Disclosure / Onboarding — #1 + #3**
The page dumps all complexity at once with no scaffolding. The UX guideline for onboarding states: provide a skippable tutorial with Skip/Back buttons — never force a linear unskippable tour, but do offer guidance. For a tool page aimed at laypeople, a **first-visit contextual banner or 2-3 step coach marks** is the standard pattern. This also addresses #3 (missing flow/CTA to next step).

**Recommended fixes (prioritized by effort-to-impact):**

| Priority | Fix                                                                       | HCI Principle Addressed | Effort |
| -------- | ------------------------------------------------------------------------- | ----------------------- | ------ |
| P0       | Contextual header/banner explaining the page purpose and what panels are  | Gulf of Execution       | Low    |
| P0       | Prominent "Continue to Analysis" CTA button                               | Gulf of Execution, Flow | Low    |
| P1       | Hover states on panels: cursor-pointer, highlight, tooltip on first hover | Affordance & Signifiers | Low    |
| P1       | First-visit coach marks (2-3 steps, skippable)                            | Progressive Disclosure  | Medium |
| P2       | Subtle drag-handle icon or pulse animation on panels                      | Signifiers              | Low    |

---

## Session: 24/03/26 - UAT 2

**Participant:** Poon Chee Yong | 57 | Retired Electrical Engineer (Homeowner)

**Strengths noted:** Analysis page feels honest — warns when layout exceeds single-phase cap, gives candid payback assessment. What-if behaviour (changing usage 600→900 kWh, single→three-phase) updates figures immediately (savings RM 213.85→RM 409.93, payback 30.2→15.7 years). Builds trust.

| #   | Page/Feature                  | Feedback                                                                                                                                                                                                                                    | Severity | Status |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | Dashboard ↔ AnalysisPage      | Status mismatch: dashboard showed "Layout Saved" while analysis page said "Analysis Ready"; only after clicking Save Analysis did dashboard update to "Analysis Complete". Confuses whether numbers are actually saved                      | High     | Open   |
| 2   | AnalysisPage (density)        | Page does too much on one screen — month-by-month table plus inline printable-report content makes it long and dense. Keep decision summary on-screen, push report content behind export/expandable section                                 | Medium   | Open   |
| 3   | WorkbenchPage (guidance)      | Interaction model still feels technical. Shows panel count, yield, rotation, annual output — good data, but needs guidance for non-specialists: what to do first, what a "good" adjustment looks like, what controls mean in plain language | High     | Open   |
| 4   | WorkbenchPage (panel visuals) | Panel objects are visually misleading — rounded green rectangles do not resemble actual solar panels. Should have sharp/rectangular edges and solar-panel colouring (dark blue → light blue, varying by irradiance)                         | Medium   | Open   |
| 5   | MapPage (reassurance)         | Search box is visible but opens onto a bare map view with little reassurance about what to do next or what the app expects from the user                                                                                                    | Medium   | Open   |

**General Comments:** As a retired installer, the participant valued the analysis page's transparency and immediate feedback loop. Main concerns are flow clarity (status consistency across pages) and the gap between the data-rich workbench and a layperson's comprehension. Panel visual fidelity also undermines credibility.

### HCI / UX Analysis

Poon's feedback — from a technically literate user — reveals issues that go _beyond_ beginner confusion. If a retired EE notices these gaps, laypeople will struggle significantly more.

**1. Visibility of System Status (Nielsen #1) — #1 High**
The dashboard and analysis page show contradictory states ("Layout Saved" vs "Analysis Ready" vs "Analysis Complete"). This violates the most fundamental heuristic: the system must always keep users informed about what is going on. The user cannot trust whether their data was actually persisted.

- **Fix:** Unify status labels into a single state machine visible consistently across all pages. A status like "Analysis Ready (unsaved)" vs "Analysis Saved" with a timestamp removes ambiguity.

**2. Recognition over Recall + Cognitive Overload (Nielsen #6 / Miller's Law) — #2 Medium**
The analysis page packs decision-making summaries _and_ full report content into one scroll. This forces users to hold context across a long page. Miller's Law says working memory handles ~7 chunks — a dense page with tables, charts, and report prose exceeds that.

- **Fix:** Progressive disclosure — keep the decision summary (savings, payback, warnings) above the fold. Collapse or move the month-by-month table and report content behind expandable sections or an "Export Report" action.

**3. Match Between System and Real World (Nielsen #2) — #4 Medium**
Rounded green rectangles violate real-world mapping. Solar panels are sharp-edged, dark-blue/black rectangles. Using rounded green shapes creates a **representational mismatch** — the user's mental model of "solar panel" doesn't match what they see. For a domain-specific tool, visual fidelity of the core object is a credibility signal.

- **Fix:** Sharp corners (`cornerRadius: 0`), blue-toned fill gradient (dark blue → lighter blue based on irradiance value), subtle grid lines or cell pattern to evoke photovoltaic cells.

**4. Reinforced: Gulf of Execution (Norman) — #3 + #5 High**
Same root issue as Eric's Session 1, now confirmed by a second, more technical user. The workbench shows _data_ (yield, rotation, output) but not _intent_ (what should I do? what's a good outcome?). The map page has the same problem — functional but not _guiding_.

- **Cross-reference:** Eric #1 (Critical), Eric #2 (High). Two independent users confirm the same gap → elevated priority.

**Recommended fixes (prioritized):**

| Priority | Fix                                                                                                          | HCI Principle                            | Effort |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------ |
| P0       | Unify status labels across dashboard ↔ analysis page into a single consistent state machine                  | Visibility of System Status (Nielsen #1) | Medium |
| P0       | Workbench: add plain-language guidance banner (what to do, what "good" looks like) — _reinforced by 2 users_ | Gulf of Execution (Norman)               | Low    |
| P1       | Analysis page: collapse report-detail sections, keep decision summary above fold                             | Recognition over Recall (Nielsen #6)     | Medium |
| P1       | Panel visuals: sharp corners, blue-toned fill, optional cell-pattern texture                                 | Real-World Match (Nielsen #2)            | Low    |
| P1       | Map page: add contextual prompt/reassurance text below search box                                            | Gulf of Execution (Norman)               | Low    |

---

## Session: 25/03/26 - UAT 3 (Analysis Page Focus)

**Participant:** Danny Low | 30 | Solar Engineer (designs residential & commercial layouts professionally)

**Strengths noted:** The billing engine is genuinely accurate — RP4 tariff disaggregation (Energy, Capacity, Network), EEI tiered rebates with correct inverse relationship, AFA waiver at 600 kWh, RE Fund at 1.6%, NEM Rakyat 3.0 credit carry-forward with year-end forfeiture, and Google Solar API carbon offset factor (671 kg CO2/MWh) all verified correct. Specific yield of ~1,651 kWh/kWp is realistic for peninsular Malaysia. Seasonal generation variation (peak March 242.2 kWh, trough December 175.8 kWh) correctly reflects northeast monsoon patterns. Every arithmetic cross-check (bill component totals, monthly savings, annual sums, CO2 offset) tallied exactly. Reactive recalculation when changing consumption (600→400 kWh) worked correctly — all KPIs updated immediately while CO2 correctly stayed constant. Simple/Advanced view toggle is a sensible design for serving both laypeople and technical users.

| #   | Page/Feature                            | Feedback                                                                                                                                                                                                                                                                                                                                                    | Severity | Status |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | AnalysisPage (net benefit projection)   | Panel degradation input (0.5%/year) is not applied to net benefit projections. 10-Year shows RM 9,110.50 = (1,298.25 x 10) - 3,872 with zero degradation. Correct value with 0.5% compounding should be ~RM 8,822. Input field exists but silently does nothing                                                                                             | High     | Resolved (25/03/26) |
| 2   | AnalysisPage (bill component breakdown) | Month selector tabs (Jan–Dec) do not update the breakdown. Clicking any month still displays January's values (Billable kWh 383.3, Total RM 216.85). Data exists in month-by-month table below, just not wiring through to breakdown view                                                                                                                   | High     | Resolved (25/03/26) |
| 3   | AnalysisPage (consumption model)        | Consumption input assumes flat value across all 12 months (every row shows 600 kWh). Malaysian households have seasonal variation (school holidays, Ramadan, etc.). Per-month or seasonal profiles would improve accuracy                                                                                                                                   | Medium   | Resolved (25/03/26) |
| 4   | AnalysisPage (system assumptions)       | No performance ratio (PR), inverter sizing, DC/AC ratio, panel tilt/azimuth, or loss factors (soiling, shading, temperature derating) shown or configurable. Disclaimers mention these qualitatively but a professional tool should quantify them                                                                                                           | Medium   | Resolved (25/03/26) |
| 5   | AnalysisPage (expand/collapse toggle)   | "Expand or collapse the full billing table" toggle for Month-by-Month Breakdown does not visually collapse the table — it remains fully expanded regardless of toggle state                                                                                                                                                                                 | Low      | Resolved (25/03/26) |
| 6   | AnalysisPage (overall verdict)          | For casual/residential use: meets the standard well — numbers are real, presentation is clear, disclaimers are honest. For basic industrial standards: gets ~80% of the way — tariff transparency is impressive but degradation bug (#1), non-functional month tabs (#2), and absent system-level assumptions (#4) prevent professional use without caveats | Medium   | Resolved (25/03/26) |

**General Comments:** As someone who prepares solar proposals for clients, I was genuinely impressed by the tariff-level transparency in the Advanced view — most commercial tools treat the billing engine as a black box. The fact that I can see every line item (Energy, Capacity, Network, EEI, AFA, RE Fund, SST) and they all check out arithmetically builds real trust. The Simple view is perfectly calibrated for a homeowner deciding "is solar worth it?" — the four headline KPIs plus the qualitative payback label ("Excellent") communicate the answer without requiring technical literacy. The what-if capability (changing consumption, phase, system cost) with instant recalculation is exactly the feature I'd use in a client consultation. However, the degradation bug and non-functional month tabs are the kind of issues that would undermine credibility if a technically literate client noticed them. Fix those two, and this becomes genuinely usable for professional preliminary assessments.

### Domain / Technical Analysis

Danny's feedback — from a practising solar engineer — tests the analysis page against **professional accuracy standards**, complementing UAT 1 (layperson usability) and UAT 2 (technical homeowner trust).

**1. Consistency Between Inputs and Outputs (Nielsen #1 / Domain Integrity) — #1 High**
The degradation rate field is a visible input that the user reasonably expects to affect projections. When it silently does nothing, it violates both visibility of system status and domain integrity — a solar professional knows degradation compounds over time and will immediately spot that 10-year savings are overstated. This is not a cosmetic issue; it is a **numerical accuracy bug** that inflates the financial case for solar.

- **Fix:** Apply `year1Savings * (1 - degradationRate)^(yr-1)` compounding in the net benefit projection calculation. Alternatively, if degradation is intentionally excluded from projections, remove the input field from the Advanced view to avoid implying it has an effect.

**2. Functional Bug: Month Tab Selector (Broken Interaction) — #2 High**
The Bill Component Breakdown's month tabs are non-functional — they render as clickable buttons with correct styling but do not update the displayed values. Since different months have materially different generation (175.8–242.2 kWh) and therefore different bill components, showing static January values is misleading. The data is correctly computed (visible in the Month-by-Month table), so this is a frontend wiring issue, not a calculation error.

- **Fix:** Wire the month tab selection state to filter the correct month's bill component data. The data source (month-by-month results array) already exists.

**3. Flat Consumption Assumption (Domain Limitation) — #3 Medium**
A flat monthly consumption model is acceptable for a v1 residential tool but limits accuracy. Malaysian consumption patterns vary meaningfully: air-conditioning load increases during hot dry spells, usage patterns shift during Ramadan and school holidays. Even a simple seasonal multiplier (e.g. hot/monsoon/transition) would improve fidelity without adding UI complexity.

- **Fix (incremental):** Add an optional "Seasonal Profile" toggle: Flat (current), Seasonal (applies typical Malaysian monthly multipliers to the base value).

**4. Missing System-Level Assumptions (Professional Gap) — #4 Medium**
Industry-standard proposals include: performance ratio (PR, typically 75–80% in Malaysia), inverter sizing and DC/AC ratio, panel tilt and azimuth, and quantified loss factors. The current disclaimers acknowledge these qualitatively, which is honest, but leaves a gap between "trustworthy estimate" and "professional quotation."

- **Fix (for professional tier):** Display a read-only "System Assumptions" card showing PR, assumed tilt/azimuth (from Google Solar API data), and a losses waterfall. This does not require new inputs — just surfacing data that the Solar API already provides.

**Recommended fixes (prioritized):**

| Priority | Fix                                                                                            | Principle / Domain Standard           | Effort |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| P0       | Apply degradation compounding to net benefit projections (or remove the input if not intended) | Domain Integrity / Numerical Accuracy | Low    |
| P0       | Wire month tab selection to update Bill Component Breakdown values                             | Functional Completeness               | Low    |
| P1       | Add optional seasonal consumption profile (flat vs. seasonal multipliers)                      | Domain Accuracy                       | Medium |
| P1       | Surface system assumptions card (PR, tilt/azimuth, losses) from existing Solar API data        | Professional Credibility              | Medium |
| P2       | Fix expand/collapse toggle for Month-by-Month table                                            | UI Polish                             | Low    |

---
