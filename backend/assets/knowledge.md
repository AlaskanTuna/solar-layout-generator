# SolarSim Assistant — Malaysian Solar Knowledge Bible

> Read this primer carefully before answering. All numbers are from Malaysia's
> RP4 tariff regime (effective 1 July 2025) and NEM Rakyat 3.0 (closed to new
> applications 30 June 2025; existing 10-year contracts continue). Translate
> technical terms into the user's language using the glossary in the system
> prompt's Layer 0.
>
> Always ground answers in the Project Digest when it contains numbers. If a
> user asks for something the digest does not expose (exact roof dimensions,
> installer quote, address, structural safety, final approval status), say that
> SolarSim cannot verify it and suggest the next app step or installer check.

## NEM Rakyat 3.0 Mechanics

NEM Rakyat 3.0 is the residential variant of Net Energy Metering 3.0, regulated
by the Energy Commission (Suruhanjaya Tenaga), administered by SEDA Malaysia,
and operated by TNB through a bi-directional meter. The programme closed to
new applications on 30 June 2025, but existing contract holders continue to
benefit under their 10-year agreement. Households entering rooftop solar after
1 January 2026 use the SolarATAP scheme instead, which SolarSim does not model.

- **True 1:1 kWh offset.** Every 1 kWh exported to the grid earns exactly 1 kWh
  of credit on the next bill. There is no cash payout — credits only reduce
  the bill — and there is no SMP discount or multiplier.
- **Credit roll-over.** Surplus credits carry forward month-to-month within the
  same calendar year (the Settlement Period). On 1 January every year, all
  accumulated credits (Baki NEM Terkumpul) reset to zero. There is no grace
  period and no payout for forfeited credits.
- **System size caps (AC inverter capacity, not DC panels).**
  - Single-phase supply: 5 kWac maximum.
  - Three-phase supply: 12.5 kWac maximum.
  - These limits are why the app's panel count may be constrained by inverter
    sizing even if more roof area is available.
- **Self-consumption is always at least as valuable as exporting.** A kWh used
  the moment it is generated avoids the import bill entirely; an exported kWh
  reduces a future imported kWh on the same RP4 rate. Oversizing a system so
  that excess credits are forfeited in December is a real risk to payback.
- **Post-contract.** After the 10-year NEM term ends, the system continues to
  generate but exports earn no further credit — only self-consumption matters.

## AFA (Automatic Fuel Adjustment)

AFA replaces the old 6-monthly ICPT (Imbalance Cost Pass-Through) and is
declared monthly by the Energy Commission to pass through the gap between
TNB's actual fuel costs and the regulated tariff. It can be a surcharge
(positive sen/kWh, increases the bill) or a rebate (negative sen/kWh, reduces
the bill). The headline cap on month-on-month movement is ±3 sen/kWh, though
larger swings have been approved by Cabinet during fuel-price spikes.

- **Bill line-item label:** "Automatic Fuel Adjustment (AFA)" — applied as
  `AFA amount = net billable kWh × declared monthly rate`.
- **Recent declared rates** (negative = rebate):
  Jul 2025: 0.00 · Aug 2025: −1.45 · Oct 2025: −6.50 · Nov 2025: −8.91 ·
  Jan 2026: −4.99 · Feb 2026: −2.77 · Mar 2026: −2.15.
- **SolarSim seed value.** The app may show −2.15 sen/kWh as the seeded AFA
  default because that was the last verified value in the project seed. AFA is
  monthly, so tell users it is safe to adjust this in Advanced view if their
  latest TNB bill or Energy Commission notice shows a different rate.
- **AFA is fully waived for households whose net consumption is ≤600 kWh in
  the billing month.** Because solar reduces net consumption, a household just
  above the 600 kWh line can drop below it after solar and stop paying AFA
  entirely — a small secondary benefit on top of the kWh offset.
- **Geography.** AFA applies to Peninsular Malaysia (TNB) only. Sabah (SESB)
  and Sarawak (SEB) have their own tariff regimes and do not use AFA.

## Tariff Structure (RP4 / Skim Tarif Pengguna 2025)

RP4 is the new Domestic General tariff effective 1 July 2025, replacing the
old 5-tier progressive block tariff in force since 2014. The total bill is
built from five charges plus pass-throughs and an EEI rebate. Numbers below
are sen/kWh unless stated.

| Component                  | Rate                                                         | Notes                                                                                                          |
| -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Energy (Generation) Charge | **27.03** if monthly use ≤1,500 kWh; **37.03** if >1,500 kWh | Cliff, not marginal — the higher rate applies to the entire month's consumption once the threshold is crossed. |
| Capacity Charge            | **4.55** flat                                                | Applies to all kWh.                                                                                            |
| Network Charge             | **12.85** flat                                               | Applies to all kWh.                                                                                            |
| Retail Charge              | **RM 10.00 / month** fixed                                   | Waived if net consumption ≤600 kWh.                                                                            |
| AFA                        | Variable monthly                                             | Waived if net consumption ≤600 kWh. See AFA section.                                                           |

Combined base subtotal: **44.43 sen/kWh** for the ≤1,500 kWh tier;
**54.43 sen/kWh** above 1,500 kWh. The average household paid roughly
13.6% more under RP4 than the old 2014 tariff before any solar offset.

- **EEI (Energy Efficiency Incentive) rebate.** A per-kWh rebate against the
  Energy Charge, applied only when monthly consumption is ≤1,000 kWh. The
  rate slides downward by bracket: 25.00 sen/kWh for the first 200 kWh,
  tapering to 0.50 sen/kWh in the 901–1,000 kWh bracket. **At >1,000 kWh the
  rebate vanishes entirely (cliff).** This means a household near the 1,000
  kWh line gets a meaningful "EEI bonus" if solar pushes net consumption back
  under that threshold.
- **RE Fund (KWTBB).** 1.6% of total consumption charges, levied to fund SEDA.
  Exempt for households whose net consumption is ≤300 kWh.
- **SST.** 8% (raised from 6% on 1 March 2024). Applied **only on the portion
  above 600 kWh** within billing periods of 28 days or more. Fully exempt if
  net consumption is ≤600 kWh.
- **Minimum monthly charge:** RM 3.00.
- **Calculation order:** net billable kWh → Energy → Capacity → Network →
  Retail → AFA → EEI rebate → RE Fund 1.6% → SST 8% on the >600 kWh portion
  → minimum charge floor → round to the nearest 5 sen.
- **Single-phase vs three-phase.** Same RP4 rates per kWh; only the NEM
  capacity cap differs (5 kWac vs 12.5 kWac).
- **Optional Time-of-Use tariff** is available for smart-meter customers but
  SolarSim does not model it.
- **Sabah and Sarawak** use entirely different regimes (SESB / SEB) — none
  of these RP4 numbers apply there.

## kWp vs kWh

Two units that homeowners often confuse.

- **kWp (kilowatt-peak)** measures **capacity** — how much DC power the panels
  can produce at the moment in standard test conditions. A "7.5 kWp system"
  describes the size of the array, like the engine displacement of a car.
- **kWh (kilowatt-hour)** measures **energy** — capacity multiplied by time.
  "850 kWh this month" describes how much electricity actually flowed,
  comparable to the litres of fuel consumed in a month.
- A 7.5 kWp system in Malaysia typically generates **about 30–35 kWh per day
  on average** (varies with weather, roof angle, shade), so roughly
  **900–1,050 kWh per month**. The exact number depends on Peak Sun Hours
  (PSH) at the location, which in Malaysia averages 4.0–4.5 PSH/day.

## Payback Methodology

SolarSim computes payback in two modes; both are derived from the same NEM
billing engine that simulates 12 months of bills before and after solar.

- **Simple payback (default mode):**
  accumulated projected bill savings recover the upfront system cost. This is
  the dominant figure quoted in Malaysian residential proposals and is what
  most homeowners recognise. SolarSim still applies the degradation and tariff
  escalation assumptions in the projection, but it does not subtract yearly
  maintenance or inverter replacement unless Lifecycle mode is selected.
- **Lifecycle payback:** the same calculation but with lifecycle costs included
  when the user enables or enters them: yearly maintenance and any scheduled
  inverter replacements. Tariff escalation defaults to 0% unless the user
  changes it; panel degradation defaults to 0.5%/year for N-type panels.
  A realistic planning case often uses maintenance around RM 500/year and a
  string inverter replacement around year 10–15 costing RM 3,000–6,000.
  Lifecycle payback is usually longer than simple payback.
- **25-year net benefit.** Total savings across the system's expected 25-year
  life, minus the upfront cost and any inverter replacement. A typical
  Malaysian terrace house on RP4 sees roughly RM 60,000–80,000 net benefit
  over 25 years on a RM 18,000–25,000 investment.
- **NEM credit forfeiture caps the value of oversizing.** Because credits
  reset to zero every January, a system that consistently exports more than
  the household imports earns nothing on those forfeited credits. The app
  models this directly by tracking the monthly credit balance and zeroing it
  at year-end.
- **Performance Ratio (PR):** the fraction of theoretical generation that
  actually reaches the meter after losses (cabling, inverter efficiency,
  soiling, temperature derating). SolarSim defaults to **0.80** in the
  AnalysisPage. A typical practical range is 0.75–0.85; lower PR is more
  conservative.
- **DC:AC ratio:** ratio of panel kWp to inverter kWac. Malaysian installs
  target **1.10–1.33**, with 1.20–1.30 common. The AnalysisPage shows a DC/AC
  assumption for homeowner context. The implemented cost model separately
  selects the smallest Huawei inverter SKU whose `inverter_kWac × 1.33` can
  carry the array, capped at the NEM phase limit (5 or 12.5 kWac).

## Solar Panel Basics

- **Panel capacity (Wp).** SolarSim's built-in residential panel catalogue uses
  current Malaysian rooftop-sized modules, not utility-scale modules:
  Jinko Tiger Neo 440 Wp, Trina Vertex S+ 440 Wp, LONGi Hi-MO 6 430 Wp,
  JA Solar DeepBlue 4.0 450 Wp, and Canadian Solar HiHero 440 Wp. The Google
  reference option is 400 Wp and should be treated as a quick placeholder.
  Higher-Wp panels mean fewer panels are needed to reach a given system size,
  easing roof layout but raising per-panel cost.
- **Panel efficiency.** Industry-leading panels are 22–23% efficient; mainstream
  market is 20–22%. Higher efficiency means more kWh from the same roof area.
- **Lifespan and warranty.** Typical product warranty 12–15 years; performance
  warranty 25–30 years (panels still ≥85% of original output at year 25).
- **Degradation.** N-type TOPCon panels lose roughly 0.35–0.5% of capacity per
  year. Older PERC panels degrade 0.5–0.7%/year. Tropical heat accelerates
  this slightly. After 25 years a 0.5%/year panel produces about 12% less
  energy than year 1.
- **Why panel orientation matters.** South-facing panels in Malaysia generate
  most because the sun tracks around overhead and often slightly south over
  Peninsular Malaysia. East- or west-facing panels may be acceptable but can
  lose yield depending on roof pitch and shading; north-facing panels are often
  weaker. SolarSim ranks panels by simulated annual yield and removes the
  lowest-yield ones first when the user reduces the count.

## SolarSim Scope and Limits

Use this section whenever a user asks "can I trust this?", "is this final?",
"why does this look wrong?", or "what should I do next?"

- SolarSim is a **planning and comparison tool**, not a final engineering
  design, installer quotation, SEDA submission, or structural approval.
- The app currently models **Peninsular Malaysia / TNB / RP4 / NEM Rakyat 3.0**.
  It does not model Sabah, Sarawak, SolarATAP cash-credit rules, Time-of-Use,
  batteries, loans, leases, or PPA repayment schedules.
- The roof layout comes from Google Solar API building insights plus satellite
  imagery. It can miss trees, awnings, water tanks, skylights, extensions,
  neighbour shading, roof damage, access paths, and structural constraints.
- The panel rectangles are good for early design reasoning, but a licensed
  installer must still verify roof strength, waterproofing, cable routes,
  inverter placement, earthing, protection devices, meter requirements, and
  authority paperwork.
- If a user wants to compare options, recommend creating separate projects or
  saving separate scenarios instead of overwriting one layout repeatedly.
- If a user asks for a go/no-go decision, answer as a cautious estimate:
  payback, credit forfeiture, system cost, and roof realism are the key signals.
  Do not say "you should definitely install"; say what the estimate suggests
  and what to verify with an installer.

## How SolarSim Works (App-Usage)

SolarSim guides the user through three pages.

- **MapPage.** Find the home on the map (search or coordinates). The app
  fetches Google Solar API building insights and high-resolution satellite
  imagery for the rooftop.
- **WorkbenchPage.** Edit the roof layout on a 2D canvas. Each blue rectangle
  is a panel placed by the Solar API analysis. The user can:
  - Adjust the slider to add or remove panels (highest-yield panels are kept
    first; lower-yield panels are removed first).
  - Click a panel to select it, then drag it to reposition, rotate it, or
    delete it. Hold Shift to multi-select.
  - Tools: Multi-Select (M), Snap to grid (S), Free Rotate (R). Hold Space to
    pan the view, scroll to zoom.
  - Toggle layers: RGB satellite imagery, flux (solar irradiance heatmap),
    DSM (height map), roof mask, and roof segments.
  - When a panel is moved, the backend recomputes its monthly energy yield
    by sampling the flux GeoTIFF at the new position.
  - Save & Continue persists the edited layout and selected panel model before
    going to Analysis. If the user changed panel positions, saving is important
    because Analysis and PDF export read saved project data.
- **AnalysisPage.** Configure system economics (monthly bill, system cost,
  panel model, tariff escalation, performance ratio, DC/AC ratio, analysis
  mode) and see the financial breakdown: payback years, 25-year net benefit,
  10-year ROI, monthly NEM bill comparison, credit usage and forfeiture, CO2
  offset. Export a PDF report.
- **Why panel positions matter for savings.** A panel on a low-flux part of
  the roof (shade, north-facing, obstructions) generates less than the same
  panel in a sunny spot — sometimes 30–50% less. The app's flux map shows
  exactly where these spots are. Moving a panel from a shaded area to a
  sunny one changes its annual yield, which changes the system's payback.

## Common Warning and Error Messages

Explain these calmly. Many are not disasters; they tell the user what needs
checking before they trust the estimate.

- **"Imagery: BASE" / lower-resolution imagery.** High-resolution imagery was
  unavailable for that address. The layout can still be useful, but panel
  positions, roof edges, and flux estimates are more approximate. Suggest
  checking the roof visually and treating the result as rougher.
- **"Computing monthly energy data" / "Batch Recompute" / "Recomputing".** The
  app is calculating monthly kWh for panels, especially after panel model
  changes or layout edits. Ask the user to wait before judging the analysis.
- **"Could not compute monthly energy breakdown. Annual estimates will be used
  instead."** The Workbench could not produce full month-by-month data. The
  annual estimate may still be useful, but month-by-month NEM billing is less
  precise. Suggest saving/retrying, then checking Analysis for missing-energy
  warnings.
- **"Monthly data not yet computed" or "panel(s) are missing monthly recompute
  data."** Those panels are treated as 0 kWh in Analysis until the layout is
  saved again from Workbench and recomputation finishes. This can make savings
  look artificially low; tell the user to go back, save the layout, and retry.
- **"The current array size exceeds the cap..."** The selected panel array is
  larger than the NEM cap for the chosen connection phase. Single-phase is
  capped at 5 kWac; three-phase at 12.5 kWac. Options: remove panels, select
  three-phase if the home has it, or ask an installer about connection upgrade.
- **"Lower TNB Tariff Tier Reached."** This is usually good news. It means solar
  reduced billable kWh below a threshold, so charges like Retail, AFA, SST, or
  the high energy tier may reduce or disappear for that month.
- **"Credit forfeited."** The system produced more NEM credit than the household
  could use before year-end. This is not a technical fault, but it may mean the
  system is oversized for the user's consumption.
- **"Analysis Unavailable" / "analysis data is incomplete."** The project data
  needed for the billing simulation is missing or stale. Direct the user back
  to Workbench to save the layout again, then return to Analysis.
- **"Workbench Unavailable."** The app could not load rooftop/layout data. The
  likely next step is to return to Dashboard or Map and retry the project.
- **"Open this on a larger screen."** The Workbench needs precise drag, rotate,
  pan, zoom, and multi-select gestures, so mobile editing is intentionally
  blocked. Use a desktop or tablet.

## Helpful Answer Patterns

- If the user asks "which panels should I remove?", look at the digest for
  active panels and max panels. Explain that SolarSim's slider keeps
  higher-yield panels first and removes lower-yield panels first; if they are
  manually editing, remove shaded, awkward, off-roof, or low-flux panels first.
- If the user asks "is this payback good?", compare it to broad Malaysian
  residential expectations: under 6 years is strong, 6–12 years is workable,
  12–25 years is weak but may still be acceptable for non-financial reasons,
  and over 25 years is poor unless assumptions are wrong.
- If the user asks "should I add more panels?", check whether savings improve
  meaningfully and whether credits are forfeited. More panels are not always
  better if they mostly create unused year-end credits.
- If the user asks "what should I ask an installer?", suggest: confirm roof
  structure and waterproofing, inverter size/phase, exact panel model, shading,
  cable route, monitoring, warranties, SEDA/TNB paperwork, final NEM eligibility,
  and quote assumptions.
