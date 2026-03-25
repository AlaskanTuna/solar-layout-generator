# Tooltip & Guidance Pass — Design Spec

**Date:** 2026-03-25
**Phase:** 4.3 (continued) — Ease-of-Use Improvements
**Trigger:** UAT 1 (Eric), UAT 2 (Poon), UAT 3 (Danny) + project owner review

## Problem

The app is data-rich but explanation-poor. UAT participants across all three sessions flagged the same root issue: technical terms, jargon-heavy labels, and missing contextual guidance make the app hard to use for non-technical homeowners. A solar engineer (UAT 3) called the numbers "genuinely accurate" but a 52-year-old homeowner (UAT 1) described feeling "blurry" on what to do.

Specific gaps: ~22 technical terms shown without explanation on the AnalysisPage, no page-level onboarding on any page, no step indicators across the 3-page workflow, and section headings that assume domain knowledge.

## Scope

Three layers of improvement across MapPage, WorkbenchPage, and AnalysisPage:

1. **Page onboarding banners** — dismissable, localStorage-persisted, one per page
2. **Section guidance text** — brief contextual sentences in card descriptions and subheadings
3. **InfoTooltips** — ~25 new hover tooltips on unexplained terms

Out of scope: interactive walkthrough/coach marks, video tutorials, help sidebar/drawer.

## Design

### Layer 1: Page Onboarding Banners

Dismissable banners rendered at the top of each page's content area. On dismiss, write `localStorage.setItem('slg-onboarding-dismissed-{page}', 'true')`. On mount, check localStorage — if truthy, don't render.

Styled as a soft info-toned banner (stone-50/stone-100 background, stone-700 text) with an X close button. Not an alert — a calm orientation message.

| Page | Banner text |
|------|-------------|
| MapPage | "Search for your home address to analyse your rooftop's solar potential." |
| WorkbenchPage | "Drag, rotate, or remove the solar panels on your roof, then click Save & Continue." |
| AnalysisPage | "See how much you could save on your electricity bill with solar — adjust your usage below." |

**Step indicators:** Each page gets a muted "Step N of 3" label rendered as part of the onboarding banner (left-aligned, before the banner text). If the banner is dismissed, the step indicator is also hidden — it served its purpose on first visit.
- MapPage: "Step 1 of 3"
- WorkbenchPage: "Step 2 of 3"
- AnalysisPage: "Step 3 of 3"

### Layer 2: Section Guidance Text

Modify existing `CardDescription` text or add small muted `<p>` elements within existing sections. No new components.

| Section | Change |
|---------|--------|
| Simple/Advanced toggle | Add muted text below: "Simple shows key savings figures. Advanced adds tariff breakdowns, projections, and system details." |
| Bill Component Breakdown card description | Change to: "See how your TNB bill is calculated — select a month to compare charges with and without solar." |
| "Without Solar" subheading | Add subtitle: "What you'd pay at full consumption" |
| "With Solar" subheading | Add subtitle: "Your bill after solar generation offsets your usage under NEM" |
| Monthly Bill Comparison chart description | Change to: "Your estimated monthly bill without solar (baseline) versus with solar (NEM) for each month." |
| Cumulative Savings chart description | Change to: "Total savings accumulated month by month over the year." |
| Net Benefit Projection description | Change to: "How much you gain (or lose) after subtracting the cost of installing your solar system." |
| WorkbenchPage sidebar controls | Add brief guidance text below the sidebar card description: "Use the slider to add or remove panels. Click a panel on the canvas to select it, then rotate or delete it." |

### Layer 3: InfoTooltips (~25 new)

Uses the existing `InfoTooltip` component (lucide-react info icon + shadcn Tooltip). All tooltip text is plain-language, one to two sentences.

#### AnalysisPage — Hero Metric Cards (4)

| Metric | Tooltip |
|--------|---------|
| Average Monthly Savings | "How much less you'd pay each month on average compared to not having solar." |
| Annual Savings | "Total savings across the full year — your bill without solar minus your bill with solar." |
| Simple Payback | "How many years until your savings cover the cost of installing the system." |
| CO2 Offset | "The amount of carbon dioxide emissions avoided by generating clean solar energy instead of using grid power." |

#### AnalysisPage — Sidebar kWp (1)

| Term | Tooltip |
|------|---------|
| System Size (kWp) | "Kilowatt-peak — the maximum power your solar system can produce under ideal sunlight conditions." |

#### AnalysisPage — Bill Components (8)

Defined as a `BILL_COMPONENT_TOOLTIPS` lookup constant. Applied to matching labels in **both** the "Without Solar" and "With Solar" columns (same tooltip text, referenced by component key to avoid duplication).

| Component | Tooltip |
|-----------|---------|
| Energy | "The base electricity charge, calculated from your kWh usage at TNB's tiered rates." |
| Capacity | "A fixed charge based on your connection capacity, applied to usage above 600 kWh." |
| Network | "Covers the cost of maintaining the electricity grid that delivers power to your home." |
| Retail | "An additional surcharge applied to usage above 600 kWh." |
| AFA | "Automatic Fuel Adjustment — a government-set surcharge (or rebate) that reflects fuel cost changes." |
| EEI Rebate | "Energy Efficiency Incentive — a rebate that rewards lower electricity consumption." |
| RE Fund | "Renewable Energy Fund — a 1.6% levy that funds Malaysia's renewable energy development." |
| SST | "Sales and Service Tax (8%) — applies only when monthly usage exceeds 600 kWh." |

#### AnalysisPage — NEM Credit Terms (4)

| Term | Tooltip |
|------|---------|
| Billable kWh | "Your consumption minus solar generation — this is what TNB actually charges you for." |
| Credit Used | "Excess solar credits from previous months applied to reduce this month's bill." |
| Credit Balance | "Unused solar credits carried forward to offset future months' bills." |
| Credit Forfeited | "Credits that expired at year-end (December) — NEM credits cannot be carried into the next year." |

#### AnalysisPage — System Assumptions (4)

| Assumption | Tooltip |
|------------|---------|
| Performance Ratio | "The percentage of theoretical solar output your system actually delivers, accounting for real-world inefficiencies." |
| Roof Azimuth / Pitch | "Azimuth is the compass direction your roof faces (180° = south). Pitch is the roof's tilt angle from horizontal." |
| Assumed Losses | "Energy lost to dust, wiring, inverter conversion, and heat — typically around 20% for residential systems." |
| DC/AC Ratio | "The ratio of panel capacity to inverter capacity. A ratio of 1.2 means slightly more panel power than the inverter can handle at peak, which maximises output across the day." |

#### WorkbenchPage (1)

| Term | Tooltip |
|------|---------|
| Annual Yield label | "Total estimated electricity your panels will generate in a year." |

### Implementation Notes

- **No new components needed.** Reuse existing `InfoTooltip`. Onboarding banners are plain JSX (`div` + `button` + `localStorage`).
- **No new dependencies.**
- **Existing tooltips unchanged.** The 6 existing AnalysisPage tooltips and 7 existing WorkbenchPage tooltips remain as-is.
- **Bill component tooltips rendered once as a lookup object** to avoid 8×2 (Without + With Solar) duplicated tooltip text. Define a `BILL_COMPONENT_TOOLTIPS` constant and reference by key.
- **TooltipProvider optimization:** Consider hoisting the `TooltipProvider` to the app root or page level instead of nesting one per `InfoTooltip` instance, since there will be ~30+ tooltips on the AnalysisPage.

### Files Changed

| File | Changes |
|------|---------|
| `frontend/src/pages/AnalysisPage.tsx` | Onboarding banner, step indicator, ~21 new InfoTooltips, section guidance text, disclaimers visibility |
| `frontend/src/pages/WorkbenchPage.tsx` | Onboarding banner, step indicator, 1 new tooltip, sidebar guidance text |
| `frontend/src/pages/MapPage.tsx` | Onboarding banner, step indicator |
| `frontend/src/lib/analysis.ts` | `BILL_COMPONENT_TOOLTIPS` constant (optional, could live in AnalysisPage) |

### Testing

- TSC clean across all workspaces
- Existing 94 frontend + 48 backend tests continue to pass (no logic changes)
- Manual verification: each tooltip renders on hover, each banner dismisses and stays dismissed on reload
