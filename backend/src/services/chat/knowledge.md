# SolarSim Assistant — Malaysian Solar Knowledge Bible

> Read this primer carefully before answering. All numbers are from Malaysia's
> RP4 tariff regime (effective 1 July 2025) and NEM Rakyat 3.0 (closed to new
> applications 30 June 2025; existing 10-year contracts continue). Translate
> technical terms into the user's language using the glossary in the system
> prompt's Layer 0.

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

| Component | Rate | Notes |
|---|---|---|
| Energy (Generation) Charge | **27.03** if monthly use ≤1,500 kWh; **37.03** if >1,500 kWh | Cliff, not marginal — the higher rate applies to the entire month's consumption once the threshold is crossed. |
| Capacity Charge | **4.55** flat | Applies to all kWh. |
| Network Charge | **12.85** flat | Applies to all kWh. |
| Retail Charge | **RM 10.00 / month** fixed | Waived if net consumption ≤600 kWh. |
| AFA | Variable monthly | Waived if net consumption ≤600 kWh. See AFA section. |

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
  `Simple Payback (years) = Total System Cost (RM) ÷ Year-1 Annual Savings (RM)`.
  This is the dominant figure quoted in Malaysian residential proposals and is
  what most homeowners recognise. It ignores tariff escalation, panel
  degradation, and inverter replacement.
- **Lifecycle payback:** the same calculation but with each future year's
  savings adjusted for tariff escalation (default 3–5%/year), panel
  degradation (default 0.5%/year for N-type TOPCon panels), and one inverter
  replacement scheduled at year 12–15 (cost RM 3,000–6,000 for a string
  inverter). Lifecycle payback is usually 0.5–1.5 years longer than simple
  payback.
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
  soiling, temperature derating). SolarSim defaults to **0.77**, which TNBX
  also uses as the standard derate factor.
- **DC:AC ratio:** ratio of panel kWp to inverter kWac. Malaysian installs
  target **1.10–1.33**, with 1.25 the typical sweet spot. SolarSim selects the
  smallest inverter where `inverter_kWac ≥ panel_kWp / 1.25`, capped at the
  NEM phase limit (5 or 12.5 kWac).

## Solar Panel Basics

- **Panel capacity (Wp).** Modern N-type TOPCon panels in Malaysia typically
  fall between 540–620 Wp per panel. Higher-Wp panels mean fewer panels are
  needed to reach a given system size, easing roof layout but raising per-panel
  cost.
- **Panel efficiency.** Industry-leading panels are 22–23% efficient; mainstream
  market is 20–22%. Higher efficiency means more kWh from the same roof area.
- **Lifespan and warranty.** Typical product warranty 12–15 years; performance
  warranty 25–30 years (panels still ≥85% of original output at year 25).
- **Degradation.** N-type TOPCon panels lose roughly 0.35–0.5% of capacity per
  year. Older PERC panels degrade 0.5–0.7%/year. Tropical heat accelerates
  this slightly. After 25 years a 0.5%/year panel produces about 12% less
  energy than year 1.
- **Why panel orientation matters.** South-facing panels in Malaysia generate
  most because the sun tracks slightly south of overhead. East- or west-facing
  panels lose 5–10% annual yield, north-facing panels lose 15–20%. SolarSim
  ranks panels by simulated annual yield and removes the lowest-yield ones
  first when the user reduces the count.

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
