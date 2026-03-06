# Knowledge Vault: Solar Potential Analysis (Page 3 MVP)

> The billing engine in this vault targets **NEM Rakyat 3.0 (1-to-1 kWh offset with carry-forward within the Settlement Period)** only.  

**Target: Peninsular Malaysia residential NEM Rakyat consumers under post-July 2025 tariff structure**

---

## 1. Executive summary

This Knowledge Vault provides everything needed to implement the billing engine and financial analysis for Page 3 of the solar layout MVP. The core algorithm takes monthly consumption, PV generation, and credit state as inputs and produces a baseline bill, NEM bill, savings figure, and updated credit balance. **Three major non-linearities** drive savings: the 1,500 kWh threshold behavior energy rate, the 600 kWh threshold that triggers SST/AFA/retail charges, and the sliding EEI rebate that rewards lower consumption. A 4 kWp system on an 800 kWh household can cut bills by roughly **RM265/month (78%)** in peak generation months, while a high-consumption household crossing below the 1,500 kWh cliff with an 8 kWp system can save over **RM660/month (73%)**. Annual PV yield of **1,200 kWh/kWp** is the recommended default, distributed monthly using 12 irradiance factors derived from Peninsular Malaysia climate data.

---

## 2. NEM Rakyat 3.0 rules

### Programme scope and eligibility

NEM Rakyat was the residential component of the NEM 3.0 programme, operational from **1 February 2021 to 30 June 2025**. Eligibility was restricted to **domestic consumers of TNB in Peninsular Malaysia** — defined as occupants of a private dwelling not used for business, trade, or professional activities. Applicants could not have participated in any prior solar programme (NEM 1.0, NEM 2.0, FiT, MBIPV) and must not have been blacklisted for outstanding bills or meter tampering. Installation was limited to **rooftop-mounted PV panels only** on the same premise, connected via indirect connection through the owner's internal distribution board. Ground-mounted and carport installations were excluded.

Sabah (SESB) and Sarawak (Sarawak Energy) operate separate schemes with different rules. The NEM 3.0 Guidelines (GP/ST/No. 27/2021) published by the Energy Commission explicitly scope the programme to TNB consumers in Peninsular Malaysia.

### Capacity limits

> **Correct NEM Rakyat capacity caps (authoritative):** 5 kW (single-phase) and 12.5 kW (three-phase). Source: SEDA NEM Rakyat / NEM GoMEn guideline (July 2023).

| Connection type | Maximum capacity |
|---|---|
| Single-phase | **5 kW (single-phase)** |
| Three-phase | **12.5 kW (three-phase)** |

These limits are codified in Section 7 of the NEM 3.0 Guidelines and restated in the NEM Rakyat Contract (TNB). Some secondary sources cite 5 kWac and 12.5 kWac following a May 2025 quota expansion, but **no official SEDA or Energy Commission document confirms revised limits**. The MVP should use 4/12.5 kW (three-phase) as the validated defaults.

### Contract duration and post-expiry

The NEM contract runs for **10 years from the date of commencement**. After expiry, the installation reverts to **self-consumption only** — no offset or roll-over of exported energy is permitted. The consumer may then transition to SelCo or the CREAM programme.

### 1-to-1 offset mechanics

**What is offset:** Exported kWh are offset against imported kWh on a true 1:1 basis. Under the post-July 2025 tariff, PETRA confirmed that NEM Rakyat (domestic/LV) offsets apply to **Energy, Capacity, and Network charges**, yielding an effective offset value of **44.43 sen/kWh** for net consumption ≤1,500 kWh or **54.43 sen/kWh** above that threshold.

**When it is netted:** Within each TNB billing cycle (monthly). A bi-directional meter records import and export separately; TNB computes the net figure for billing.

**Offset priority (pre-July 2025 tariff):** Export credits historically offset the **highest tariff block first** (descending order), maximising the per-kWh value. Under the new tariff, this is moot because there is only a single flat rate per threshold tier.

**What cannot be offset:** The Retail Charge (RM10/month fixed), AFA, SST, and RE Fund are **not offset** by NEM export credits. There is no cash payment for any excess — no kWh can ever convert to a cash payout.

### Export credit carry-forward and forfeiture

Excess credits (when export exceeds import in a billing cycle) roll over for **a maximum of 12 months within the Settlement Period**. The Settlement Period runs from **1 January to 31 December** each calendar year. Any remaining credits at the end of the Settlement Period are **forfeited with no compensation**. The first settlement period after system commissioning may be shorter than 12 months (e.g., a system commissioned in July has its first settlement period end that same December).

### Programme status as of March 2026

**Key sources:** NEM 3.0 Guidelines GP/ST/No. 27/2021 (seda.gov.my); SEDA NEM 3.0 FAQ (seda.gov.my/reportal/nem/nem3-faq/); Energy Commission FAQ (st.gov.my); NEM Rakyat Contract (TNB); PETRA statement 1 July 2025 (soyacincau.com, lowyat.net).

---

## 3. TNB domestic tariff structure

### The new unbundled tariff (Regulatory Period 4, effective 1 July 2025)

The old five-tier block-rate Tariff A was **abolished** on 30 June 2025. The replacement system under RP4 (1 July 2025 – 31 December 2027) unbundles the bill into five components. The base tariff rose from 39.95 to **45.40 sen/kWh** — a 13.64% increase.

**A. Energy (Generation) Charge — the threshold behavior rate:**

| Monthly consumption | Rate |
|---|---|
| ≤ 1,500 kWh | **27.03 sen/kWh** |
| > 1,500 kWh | **37.03 sen/kWh** |

This is a **threshold-based rate, not a block rate**. If consumption exceeds 1,500 kWh by even 1 unit, **all** kWh are charged at 37.03. This creates a cliff where crossing from 1,500 to 1,501 kWh adds approximately **RM150** to the energy charge alone. Multiple sources including TNB's own calculator confirm this behaviour.

**B. Capacity Charge:** **4.55 sen/kWh** on all consumption (covers generation reserve costs).

**C. Network Charge:** **12.85 sen/kWh** on all consumption (covers grid delivery).

**D. Retail Charge:** **RM10.00/month** fixed fee (metering, billing, customer service). **Waived** for consumption **≤ 600 kWh**.

**E. Automatic Fuel Adjustment (AFA):** Variable monthly rate replacing the old semi-annual ICPT. Capped at ±3 sen/kWh change per month. **Waived** for consumption **≤ 600 kWh**. Recent rates:

| Month | AFA (sen/kWh) |
|---|---|
| Jul 2025 | 0.00 |
| Oct 2025 | −6.50 |
| Jan 2026 | −4.99 |
| Feb 2026 | **−2.77** (latest confirmed) |

### Energy Efficiency Incentive (EEI)

A tiered rebate for consumers using **≤ 1,000 kWh/month**, applied uniformly to all kWh based on which 50 kWh bracket total consumption falls in:

| kWh bracket | Rebate (sen/kWh) | | kWh bracket | Rebate (sen/kWh) |
|---|---|---|---|---|
| 1–200 | **25.00** | | 501–550 | 10.50 |
| 201–250 | 24.50 | | 551–600 | 9.00 |
| 251–300 | 22.50 | | 601–650 | 7.50 |
| 301–350 | 21.00 | | 651–700 | 5.50 |
| 351–400 | 17.00 | | 701–750 | 4.50 |
| 401–450 | 14.50 | | 751–800 | 4.00 |
| 451–500 | 12.00 | | 801–850 | 2.50 |
| | | | 851–900 | 1.00 |
| | | | 901–1,000 | 0.50 |
| | | | > 1,000 | **0.00** |

**Caveat:** PETRA indicated that EEI rates and calculations "will be adjusted" for NEM/MBIPV users "to ensure greater equity." Exact modifications have not been published. The MVP should use the standard table as default but flag this as a potential future change.

### Surcharges and taxes

> **AFA implementation note:** AFA (Automatic Fuel Adjustment) changes over time (typically monthly/periodically). For MVP, expose `afa_sen_per_kwh` as a **config / user input** (default 0) and include it in the bill engine only if you explicitly choose to model it.

**RE Fund (KWTBB):** 1.6% surcharge applied to (Energy + Capacity + Network charges). **Exempt** for consumption **≤ 300 kWh**.

**Service Tax (SST):** **8%** on the total bill. **Exempt** for consumption **≤ 600 kWh**. Applies to all bill components including RE Fund.

**Minimum charge:** **RM3.00/month** when the computed bill falls below this floor.

### Combined effective rates before AFA and taxes

| Consumption level | Energy + Capacity + Network | Key waivers |
|---|---|---|
| ≤ 600 kWh | 44.43 sen/kWh | Retail, AFA, SST all waived |
| 601–1,500 kWh | 44.43 sen/kWh | + RM10 retail + AFA + SST |
| > 1,500 kWh | **54.43 sen/kWh** | + RM10 retail + AFA + SST |

### NEM interaction with thresholds

For NEM users, the **net import figure** (after export offset and credit application) determines all threshold eligibility. If NEM reduces a consumer's billable kWh to ≤600, they qualify for the retail charge waiver, AFA waiver, and SST exemption. If it drops to ≤1,000, they receive the EEI rebate. If it drops below 1,500, they avoid the threshold behavior energy rate. TNB's bill calculator includes a dedicated NEM mode that accepts both consumption and export generation inputs, confirming this treatment.

**Key sources:** TNB official tariff page (mytnb.com.my/tariff); SoyaCincau 21 Jun 2025; paultan.org 20 Jun 2025; PETRA 1 Jul 2025 statement; solarsunyield.com tariff guide; TNB RE Handbook (KWTBB); RinggitPlus bill guide.

---

## 4. Billing algorithms

### Step-by-step baseline bill computation (no PV)

Given: `consumption_kwh`, `afa_rate` (sen/kWh, current month).

1. **Energy charge** = `consumption_kwh` × rate, where rate = 27.03 if `consumption_kwh` ≤ 1,500, else 37.03 (sen/kWh)
2. **Capacity charge** = `consumption_kwh` × 4.55 sen/kWh
3. **Network charge** = `consumption_kwh` × 12.85 sen/kWh
4. **Retail charge** = RM10.00 if `consumption_kwh` > 600, else RM0
5. **AFA** = `consumption_kwh` × `afa_rate` / 100 if `consumption_kwh` > 600, else RM0 (negative = rebate)
6. **EEI rebate** = `consumption_kwh` × `eei_rate(consumption_kwh)` / 100
7. **Pre-tax subtotal** = Energy + Capacity + Network + Retail + AFA − EEI
8. **RE Fund** = 1.6% × (Energy + Capacity + Network) if `consumption_kwh` > 300, else RM0
9. **SST** = 8% × (Pre-tax subtotal + RE Fund) if `consumption_kwh` > 600, else RM0
10. **Total** = max(Pre-tax subtotal + RE Fund + SST, RM3.00)

### Step-by-step NEM bill computation (with PV)

Given: `consumption_kwh`, `generation_kwh`, `credit_balance_kwh`, `afa_rate`, `is_december` (boolean).

**Phase 1 — Net import calculation:**

1. `within_month_net` = `consumption_kwh` − `generation_kwh`
2. If `within_month_net` ≥ 0: consumer still needs grid power
   - `credit_applied` = min(`credit_balance_kwh`, `within_month_net`)
   - `billable_kwh` = `within_month_net` − `credit_applied`
   - `remaining_credit` = `credit_balance_kwh` − `credit_applied`
   - `new_credit` = 0
3. If `within_month_net` < 0: surplus generation
   - `billable_kwh` = 0
   - `new_credit` = |`within_month_net`|
   - `remaining_credit` = `credit_balance_kwh`

4. `updated_credit` = `remaining_credit` + `new_credit`
5. If `is_december`: `forfeited` = `updated_credit`; `updated_credit` = 0

**Phase 2 — Bill on billable kWh:** Apply the same 10-step baseline algorithm using `billable_kwh` as the consumption input.

**Phase 3 — Savings:** `savings` = `baseline_bill(consumption_kwh)` − `nem_bill(billable_kwh)`

### Key insight: self-consumption ratio is irrelevant under NEM 1:1

---

## 5. Credit carry-forward and expiry model

### Calendar-year settlement period

The credit model is **simpler than a rolling 12-month window**. All credits expire on 31 December each year, regardless of when they were generated. A credit earned in January can persist through 11 more months; a credit earned in December survives for zero additional months. On 1 January, the balance resets to zero.

### State machine

The credit state requires only two variables: `balance_kwh` (float) and `settlement_year` (int). At the start of each month:

1. Check if the current year exceeds `settlement_year`. If so, forfeit the entire balance and update `settlement_year`.
2. Compute `within_month_net`. If positive and `balance_kwh > 0`, apply credits to reduce billable kWh.
3. If `within_month_net` is negative, add the surplus to `balance_kwh`.

### Why per-credit expiry tracking is unnecessary

Because all credits share a single forfeiture event (year-end), there is no need to track when each individual credit was generated. A single running balance suffices. This dramatically simplifies the data model — the MVP does **not** need a queue or stack of dated credit entries.

### Edge case: system commissioned mid-year

If a consumer's NEM contract starts in, say, September, their first settlement period runs September–December (only 4 months). Credits accumulated in this short window are forfeited on 31 December. From the following January onward, full 12-month settlement periods apply.

---

## 6. PV monthly generation method

### Recommended annual yield default

Based on IEN Consultants' professional standard for Kuala Lumpur and multiple simulation studies, the recommended default specific yield for a Peninsular Malaysia residential system is **1,200 kWh/kWp/year**. A conservative-to-optimistic range is **1,100–1,400 kWh/kWp/year**. The recommended performance ratio is **0.75**.

### Monthly irradiance distribution factors

Peninsular Malaysia's equatorial location produces relatively uniform monthly irradiance. The peak-to-trough ratio is only **1.39:1** (March to November). The following factors are derived from PVsyst Meteonorm data for a representative west-coast Peninsular Malaysia location and cross-validated against MMD ground-station records:

| Month | Factor | kWh for 1 kWp | | Month | Factor | kWh for 1 kWp |
|---|---|---|---|---|---|---|
| Jan | 0.088 | 105.6 | | Jul | 0.082 | 98.4 |
| Feb | 0.090 | 108.0 | | Aug | 0.080 | 96.0 |
| **Mar** | **0.100** | **120.0** | | Sep | 0.078 | 93.6 |
| Apr | 0.092 | 110.4 | | Oct | 0.075 | 90.0 |
| May | 0.087 | 104.4 | | **Nov** | **0.072** | **86.4** |
| Jun | 0.080 | 96.0 | | Dec | 0.076 | 91.2 |

Factors sum to **1.000**. March is the peak month; November is the lowest (northeast monsoon onset).

### Conversion formula

```
monthly_generation(kWp, month) = kWp × annual_yield_per_kWp × factor[month]
```

For a 4 kWp system: `4 × 1,200 × 0.100 = 480 kWh` in March; `4 × 1,200 × 0.072 = 346 kWh` in November.

### Feasible MVP approach

The simplest viable approach is a **static lookup table** of 12 monthly factors combined with a user-adjustable annual yield slider. This avoids the complexity of hourly simulation, location-specific irradiance databases, or tilt/azimuth modelling while producing results within ±10% of detailed simulation for typical rooftop installations. The factors above are suitable for west-coast and central Peninsular Malaysia. East-coast locations experience deeper seasonal variation due to northeast monsoon exposure; a future enhancement could offer location-based factor sets.

**Key sources:** PVsyst Meteonorm monthly GHI tables (ResearchGate 2023 study); IEN Consultants KL standard (1,200 kWh/kWp); Malaysian Meteorological Department Subang data (1993–2002); SEDA PVMS monitoring (pvms.seda.gov.my); Shavalipour et al. 2013 (Int. J. Photoenergy); MetMalaysia monsoon data.

---

## 7. Worked examples

All examples use AFA = −2.77 sen/kWh (February 2026 rate). Currency in RM. All figures rounded to 2 decimal places.

### Scenario A: Medium consumer, 4 kWp system, March (no prior credits)

**Inputs:** Consumption = 800 kWh. PV generation = 480 kWh (4 kWp × 1,200 × 0.100). Credit balance = 0 kWh.

**Baseline bill (800 kWh, no PV):**

| Component | Calculation | Amount (RM) |
|---|---|---|
| Energy | 800 × 27.03 sen | 216.24 |
| Capacity | 800 × 4.55 sen | 36.40 |
| Network | 800 × 12.85 sen | 102.80 |
| Retail | > 600 kWh | 10.00 |
| AFA | 800 × (−2.77) sen | −22.16 |
| EEI | 800 kWh → 4.00 sen bracket → 800 × 4.00 | −32.00 |
| **Pre-tax subtotal** | | **311.28** |
| RE Fund | 1.6% × (216.24 + 36.40 + 102.80) = 1.6% × 355.44 | 5.69 |
| SST | 8% × (311.28 + 5.69) | 25.36 |
| **Total baseline** | | **342.33** |

**NEM bill (320 kWh billable = 800 − 480):**

| Component | Calculation | Amount (RM) |
|---|---|---|
| Energy | 320 × 27.03 sen | 86.50 |
| Capacity | 320 × 4.55 sen | 14.56 |
| Network | 320 × 12.85 sen | 41.12 |
| Retail | ≤ 600 kWh → waived | 0.00 |
| AFA | ≤ 600 kWh → waived | 0.00 |
| EEI | 320 kWh → 21.00 sen bracket → 320 × 21.00 | −67.20 |
| **Pre-tax subtotal** | | **74.98** |
| RE Fund | 1.6% × (86.50 + 14.56 + 41.12) = 1.6% × 142.18 | 2.27 |
| SST | ≤ 600 kWh → exempt | 0.00 |
| **Total NEM** | | **77.25** |

**Monthly savings: RM265.08 (77.4%).** Credit balance remains 0 kWh. The dramatic savings arise from three compounding effects: direct kWh offset, crossing below the 600 kWh threshold (eliminating retail/AFA/SST), and jumping to a much higher EEI rebate bracket (from 4.00 to 21.00 sen/kWh).

### Scenario B: Low consumer with surplus generation (March, existing credits)

**Inputs:** Consumption = 300 kWh. PV generation = 480 kWh. Credit balance = 50 kWh.

Net import = 300 − 480 = **−180 kWh** → billable = 0 kWh; new credit = 180 kWh. Updated credit = 50 + 180 = **230 kWh**.

**Baseline bill (300 kWh):**

| Component | Calculation | Amount (RM) |
|---|---|---|
| Energy | 300 × 27.03 | 81.09 |
| Capacity | 300 × 4.55 | 13.65 |
| Network | 300 × 12.85 | 38.55 |
| Retail / AFA | ≤ 600 kWh → waived | 0.00 |
| EEI | 300 kWh → 22.50 sen → 300 × 22.50 | −67.50 |
| RE Fund | ≤ 300 kWh → exempt | 0.00 |
| SST | ≤ 600 kWh → exempt | 0.00 |
| **Total baseline** | | **65.79** |

**NEM bill (0 kWh):** Falls below minimum → **RM3.00**.

**Monthly savings: RM62.79.** Credit balance: 230 kWh (carries to next month). The minimum charge floor means zero-kWh bills still cost RM3.00.

### Scenario C: High consumer crossing the 1,500 kWh cliff (March)

**Inputs:** Consumption = 1,600 kWh. PV system = 8 kWp (three-phase). Generation = 960 kWh (8 × 1,200 × 0.100). Credit balance = 0 kWh.

**Baseline bill (1,600 kWh — ABOVE the 1,500 cliff):**

| Component | Calculation | Amount (RM) |
|---|---|---|
| Energy | 1,600 × **37.03** sen (cliff rate!) | 592.48 |
| Capacity | 1,600 × 4.55 | 72.80 |
| Network | 1,600 × 12.85 | 205.60 |
| Retail | > 600 kWh | 10.00 |
| AFA | 1,600 × (−2.77) | −44.32 |
| EEI | > 1,000 kWh → none | 0.00 |
| **Pre-tax subtotal** | | **836.56** |
| RE Fund | 1.6% × 870.88 | 13.93 |
| SST | 8% × 850.49 | 68.04 |
| **Total baseline** | | **918.53** |

**NEM bill (640 kWh = 1,600 − 960, BELOW the cliff):**

| Component | Calculation | Amount (RM) |
|---|---|---|
| Energy | 640 × **27.03** sen (lower rate!) | 173.00 |
| Capacity | 640 × 4.55 | 29.12 |
| Network | 640 × 12.85 | 82.24 |
| Retail | > 600 kWh | 10.00 |
| AFA | 640 × (−2.77) | −17.73 |
| EEI | 640 kWh → 7.50 sen → 640 × 7.50 | −48.00 |
| **Pre-tax subtotal** | | **228.63** |
| RE Fund | 1.6% × 284.36 | 4.55 |
| SST | 8% × 233.18 | 18.65 |
| **Total NEM** | | **251.83** |

**Monthly savings: RM666.70 (72.6%).** This exceptional savings comes from simultaneously crossing the 1,500 kWh cliff (energy rate drops by 10 sen/kWh on all units), qualifying for EEI rebate, and reducing the SST/AFA base.

### Scenario D: Credit expiry at year-end (December)

**Inputs:** Consumption = 500 kWh. Generation = 365 kWh (4 kWp × 1,200 × 0.076). Credit balance = 200 kWh. Month = December.

Net import = 500 − 365 = 135 kWh. Credit applied = min(200, 135) = 135. **Billable = 0 kWh.** Remaining credit = 200 − 135 + 0 = 65 kWh. December = settlement period end → **65 kWh forfeited** (value lost: ~RM29).

Baseline: **RM165.70** (same structure as Scenario B calculations at 500 kWh). NEM bill: **RM3.00** (minimum). Savings: **RM162.70.** Credit resets to 0 on 1 January.

---

## 8. Pseudocode and data models

### Constants

```python
# Tariff rates (sen/kWh unless noted)
ENERGY_RATE_LOW    = 27.03   # ≤ 1,500 kWh
ENERGY_RATE_HIGH   = 37.03   # > 1,500 kWh
CAPACITY_RATE      = 4.55
NETWORK_RATE       = 12.85
RETAIL_CHARGE_RM   = 10.00   # RM/month

# Thresholds (kWh)
ENERGY_CLIFF       = 1500
RETAIL_WAIVER      = 600
AFA_WAIVER         = 600
SST_EXEMPTION      = 600
EEI_MAX            = 1000
RE_FUND_EXEMPTION  = 300

# Rates
SST_RATE           = 0.08    # 8%
RE_FUND_RATE       = 0.016   # 1.6%
MIN_CHARGE_RM      = 3.00

# EEI lookup: (upper_bound_kwh, rebate_sen_per_kwh)
EEI_TABLE = [
    (200, 25.00), (250, 24.50), (300, 22.50), (350, 21.00),
    (400, 17.00), (450, 14.50), (500, 12.00), (550, 10.50),
    (600,  9.00), (650,  7.50), (700,  5.50), (750,  4.50),
    (800,  4.00), (850,  2.50), (900,  1.00), (1000, 0.50),
]

# Monthly PV irradiance distribution factors (sum = 1.000)
MONTHLY_FACTORS = {
    1: 0.088, 2: 0.090, 3: 0.100, 4: 0.092,
    5: 0.087, 6: 0.080, 7: 0.082, 8: 0.080,
    9: 0.078, 10: 0.075, 11: 0.072, 12: 0.076,
}
DEFAULT_YIELD_KWH_PER_KWP = 1200
```

### Core functions

```python
def get_eei_rate(consumption_kwh: float) -> float:
    """Return EEI rebate in sen/kWh for given consumption."""
    if consumption_kwh <= 0 or consumption_kwh > EEI_MAX:
        return 0.0
    for upper, rate in EEI_TABLE:
        if consumption_kwh <= upper:
            return rate
    return 0.0

def compute_bill(kwh: float, afa_sen: float = 0.0) -> dict:
    """
    Compute monthly TNB domestic bill under RP4 tariff.
    Args:
        kwh: Billable consumption in kWh (net import for NEM users).
        afa_sen: Current month AFA rate in sen/kWh (negative = rebate).
    Returns:
        Dict with all bill components and total in RM.
    """
    if kwh <= 0:
        return {"total": MIN_CHARGE_RM, "components": {}, "kwh": 0}

    # --- Component charges ---
    e_rate = ENERGY_RATE_LOW if kwh <= ENERGY_CLIFF else ENERGY_RATE_HIGH
    energy   = kwh * e_rate / 100
    capacity = kwh * CAPACITY_RATE / 100
    network  = kwh * NETWORK_RATE / 100
    retail   = RETAIL_CHARGE_RM if kwh > RETAIL_WAIVER else 0.0
    afa      = (kwh * afa_sen / 100) if kwh > AFA_WAIVER else 0.0

    # --- EEI rebate ---
    eei_sen  = get_eei_rate(kwh)
    eei      = kwh * eei_sen / 100

    # --- Pre-tax subtotal ---
    subtotal = energy + capacity + network + retail + afa - eei

    # --- RE Fund (KWTBB) ---
    re_fund  = RE_FUND_RATE * (energy + capacity + network) \
               if kwh > RE_FUND_EXEMPTION else 0.0

    # --- SST ---
    sst      = SST_RATE * (subtotal + re_fund) \
               if kwh > SST_EXEMPTION else 0.0

    total    = max(subtotal + re_fund + sst, MIN_CHARGE_RM)

    return {
        "kwh": kwh,
        "energy": round(energy, 2),
        "capacity": round(capacity, 2),
        "network": round(network, 2),
        "retail": round(retail, 2),
        "afa": round(afa, 2),
        "eei_rebate": round(eei, 2),
        "re_fund": round(re_fund, 2),
        "sst": round(sst, 2),
        "total": round(total, 2),
    }

def compute_nem_month(
    consumption_kwh: float,
    generation_kwh: float,
    credit_balance: float,
    afa_sen: float = 0.0,
    month: int = 1,         # 1-12
    year: int = 2026,
    settlement_year: int = 2026,
) -> dict:
    """
    Compute one month of NEM billing and update credit state.
    Returns dict with baseline_bill, nem_bill, savings,
    updated credit_balance, and forfeited amount.
    """
    # --- Settlement period reset (January) ---
    forfeited = 0.0
    if year > settlement_year:
        forfeited = credit_balance
        credit_balance = 0.0
        settlement_year = year

    # --- Net import ---
    net = consumption_kwh - generation_kwh

    if net >= 0:
        credit_used = min(credit_balance, net)
        billable = net - credit_used
        credit_balance -= credit_used
        new_credit = 0.0
    else:
        billable = 0.0
        new_credit = abs(net)
        credit_used = 0.0

    credit_balance += new_credit

    # --- Year-end forfeiture (December) ---
    if month == 12:
        forfeited += credit_balance
        credit_balance = 0.0

    # --- Bills ---
    baseline = compute_bill(consumption_kwh, afa_sen)
    nem      = compute_bill(billable, afa_sen)
    savings  = baseline["total"] - nem["total"]

    return {
        "month": month,
        "year": year,
        "consumption_kwh": consumption_kwh,
        "generation_kwh": generation_kwh,
        "billable_kwh": round(billable, 1),
        "credit_used": round(credit_used, 1),
        "credit_balance": round(credit_balance, 1),
        "credit_forfeited": round(forfeited, 1),
        "baseline_bill": baseline,
        "nem_bill": nem,
        "savings_rm": round(savings, 2),
        "settlement_year": settlement_year,
    }

def monthly_pv_generation(
    system_kwp: float,
    month: int,
    annual_yield: float = DEFAULT_YIELD_KWH_PER_KWP,
) -> float:
    """Return estimated PV generation for a given month."""
    return system_kwp * annual_yield * MONTHLY_FACTORS[month]

def update_credit_state(
    current_balance: float,
    current_year: int,
    settlement_year: int,
) -> tuple:  # (new_balance, new_settlement_year, forfeited)
    """Handle settlement period transitions."""
    if current_year > settlement_year:
        return 0.0, current_year, current_balance
    return current_balance, settlement_year, 0.0
```

### Data structures for credit tracking

```python
from dataclasses import dataclass, field
from typing import List

@dataclass
class CreditState:
    balance_kwh: float = 0.0
    settlement_year: int = 2026

@dataclass
class MonthlyResult:
    month: int
    year: int
    consumption_kwh: float
    generation_kwh: float
    billable_kwh: float
    baseline_bill_rm: float
    nem_bill_rm: float
    savings_rm: float
    cumulative_savings_rm: float
    credit_balance_kwh: float
    credit_forfeited_kwh: float

@dataclass
class AnnualSummary:
    year: int
    total_consumption_kwh: float
    total_generation_kwh: float
    total_baseline_rm: float
    total_nem_rm: float
    total_savings_rm: float
    total_credits_forfeited_kwh: float
    months: List[MonthlyResult] = field(default_factory=list)

@dataclass
class SystemConfig:
    capacity_kwp: float          # e.g., 4.0 or 8.0
    annual_yield_per_kwp: float  # default 1200
    system_cost_rm: float        # total installed cost
    connection_phase: str        # "single" or "three"
    commission_date: str         # ISO date, e.g. "2024-03-15"
    contract_end_date: str       # commission + 10 years
```

---

## 9. Validation and unit test cases

### Golden test cases

All use AFA = −2.77 sen/kWh. Expected values are computed manually and serve as regression anchors.

| ID | Consumption | Generation | Prior credit | Billable | Baseline (RM) | NEM (RM) | Savings (RM) | New credit | Notes |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 800 | 480 | 0 | 320 | 342.33 | 77.25 | 265.08 | 0 | Scenario A reference |
| T2 | 300 | 480 | 50 | 0 | 65.79 | 3.00 | 62.79 | 230 | Surplus → credit |
| T3 | 500 | 365 | 200 | 0 | 165.70 | 3.00 | 162.70 | 65→0* | *Dec forfeiture |
| T4 | 1600 | 960 | 0 | 640 | 918.53 | 251.83 | 666.70 | 0 | Cliff crossing |
| T5 | 0 | 0 | 0 | 0 | 3.00 | 3.00 | 0.00 | 0 | Zero usage |
| T6 | 100 | 0 | 0 | 100 | ~6.43 | ~6.43 | 0.00 | 0 | Low usage, EEI 25 sen |
| T7 | 1500 | 0 | 0 | 1500 | ~696.67* | same | 0 | 0 | Just at threshold behavior |
| T8 | 1501 | 0 | 0 | 1501 | ~846.77* | same | 0 | 0 | Just over cliff |
| T9 | 601 | 200 | 0 | 401 | ~236.36* | ~119.10* | ~117.26 | 0 | Cross below 600 |
| T10 | 400 | 600 | 100 | 0 | ~126.56* | 3.00 | ~123.56 | 300 | Large surplus |

*Approximate values — compute precisely during implementation.

### Edge cases to validate

- **PV > consumption with no prior credits:** Billable = 0; credit = generation − consumption; bill = RM3.00
- **Very low usage (< 200 kWh):** EEI rebate at 25 sen/kWh may make the pre-tax subtotal very small; ensure minimum charge of RM3.00 applies
- **Exactly 600 kWh:** All waivers apply (retail, AFA, SST exempt); verify this boundary
- **Exactly 601 kWh:** All waivers lost; retail + AFA + SST all kick in; verify the discontinuity
- **Exactly 1,500 kWh vs 1,501 kWh:** Energy rate cliff; verify ~RM150 jump
- **Exactly 300 kWh:** RE Fund exempt; at 301 kWh it applies
- **Exactly 1,000 kWh vs 1,001 kWh:** EEI drops from 0.50 sen to 0.00 sen
- **December with credits:** Verify forfeiture and balance reset
- **January after December forfeiture:** Balance must be 0 at start
- **Negative AFA (rebate) for ≤ 600 kWh user:** AFA is waived, not applied as rebate — user does not receive the rebate benefit
- **Large credit balance exceeding net import:** Only needed credits are consumed; excess carries forward
- **Zero generation month (e.g., system down):** Bill equals baseline; credits still available
- **First settlement period shorter than 12 months:** Commission in October → settlement ends December (3 months)

### Validation plan

1. **Unit tests:** Implement each golden test case as an automated test against `compute_bill()` and `compute_nem_month()`. Assert exact RM values to 2 decimal places.
2. **Boundary tests:** Test all threshold boundaries (±1 kWh) for 300, 600, 1000, 1500 kWh.
3. **12-month integration test:** Run a full calendar year simulation for each scenario. Verify cumulative savings, credit accumulation, and year-end forfeiture.
4. **Cross-validation:** Compare outputs against TNB's official bill calculator (mytnb.com.my/tariff) for 5+ consumption levels.
5. **Property-based tests:** For any inputs, `nem_bill ≤ baseline_bill`. For any inputs, `savings ≥ 0`. For any inputs, `bill ≥ RM3.00`. Credit balance is non-negative.
6. **Regression suite:** Lock golden test outputs and run on every code change.

---

## 10. UX notes and disclaimers

### Financial outputs for Page 3

**Primary display (above the fold):**
- Monthly bill with PV (RM) — the NEM bill
- Monthly bill without PV (RM) — the baseline
- Monthly savings (RM and %)
- Cumulative savings (RM, line chart over system lifetime)
- Estimated payback period (years and months)
- Estimated 10-year ROI (%)

**Secondary display (expandable detail):**
- Month-by-month table: consumption, generation, billable kWh, credit balance, baseline vs NEM bill, savings
- Credit balance timeline showing accumulation and year-end forfeiture events
- Bill component breakdown (energy, capacity, network, retail, AFA, EEI, RE Fund, SST)

### User-editable inputs and defaults

| Input | Default | Range | Notes |
|---|---|---|---|
| Monthly consumption (kWh) | 600 | 100–3,000 | Pre-fill from user's TNB bill if available |
| System capacity (kWp) | 4.0 | 1–10 | Constrained by phase (max 4 single / 10 three) |
| Connection phase | Single | Single / Three | Determines capacity cap |
| Annual yield (kWh/kWp) | 1,200 | 1,000–1,500 | Advanced slider, hidden by default |
| System cost (RM) | 18,000 | 8,000–80,000 | For payback/ROI; can auto-estimate from kWp |
| AFA rate (sen/kWh) | −2.77 | −10 to +10 | Advanced; update monthly |

### What to exclude from MVP

- Time-of-Use (ToU) tariff modelling — requires half-hourly load profiles
- eKasih RM40/month rebate — rare, edge case
- Panel degradation over time — add in v2 payback model
- Inflation-adjusted tariff projections
- Battery storage (BESS) modelling
- Shading analysis and tilt/azimuth optimisation
- Multiple buildings or shared solar

### Critical threshold tooltips

The UI should display warning indicators at these consumption levels:

- **600 kWh:** "Staying at or below 600 kWh exempts you from the RM10 retail charge, fuel adjustment (AFA), and 8% service tax."
- **1,000 kWh:** "The Energy Efficiency Incentive rebate applies only to consumption of 1,000 kWh or below."
- **1,500 kWh:** "Above 1,500 kWh, the energy rate increases from 27.03 to 37.03 sen/kWh on your entire consumption — a jump of approximately RM150."

### Required disclaimers

1. "Estimates are based on published TNB tariff rates under Regulatory Period 4 (effective 1 July 2025) and NEM Rakyat 3.0 rules. Actual bills may vary due to billing cycle length, meter reading dates, and tariff adjustments."
2. "The Automatic Fuel Adjustment (AFA) rate changes monthly. Estimates use the latest known rate and may not reflect future changes."
3. "PETRA has indicated that Energy Efficiency Incentive (EEI) rates may be adjusted for NEM users. Current calculations use standard EEI rates pending official modification."
5. "Solar generation estimates are based on average irradiance data. Actual output varies with weather, shading, panel orientation, soiling, and equipment condition."
6. "Excess credits are forfeited at the end of each calendar year. No cash payment is made for unused credits."

---

## 11. Appendix: source links and notes

### Primary regulatory sources

| Source | URL | Content |
|---|---|---|
| NEM 3.0 Guidelines (GP/ST/No.27/2021) | seda.gov.my/reportal/wp-content/uploads/2021/01/NEM3-Guidelines.pdf | Full programme rules, definitions, eligibility |
| SEDA NEM 3.0 FAQ | seda.gov.my/reportal/nem/nem3-faq/ | Contract duration, credit rules, offset mechanics |
| Energy Commission (ST) NEM FAQ | st.gov.my/contents/files/highlights/2021-02-16/1613454154.pdf | Eligibility, capacity limits, geographic scope |
| NEM Rakyat Contract (TNB) | seda.gov.my/reportal/wp-content/uploads/2021/03/NEM-Rakyat-Contract-TNB.pdf | Contractual terms, capacity limits |
| SEDA NEM Main Page | seda.gov.my/reportal/nem/ | Programme overview, credit forfeiture |
| SEDA Offset FAQ | seda.gov.my/misc/frequently-asked-questions/net-metering-nem-faq/ | 1:1 offset definition, descending order |

### Tariff and billing sources

| Source | URL | Content |
|---|---|---|
| TNB Official Tariff Page | mytnb.com.my/tariff | RP4 tariff structure (note: may return 403; use cached data) |
| myTNB Billing Components | mytnb.com.my/residential/understand-your-bill/billing-component | Old structure reference; KWTBB formula |
| TNB RE Handbook (KWTBB) | Via anyflip.com/duyiz/ddgh | RE Fund calculation formula |
| SoyaCincau Tariff Analysis (21 Jun 2025) | soyacincau.com/2025/06/21/tnb-domestic-electricity-tariff-structure-july-2025-impact-changes/ | Comprehensive new tariff breakdown |
| paultan.org Tariff Calculation | paultan.org/2025/06/21/tnb-new-electricity-tariff-calculation-from-july-2025/ | Confirms threshold behavior rate behaviour |
| paultan.org AFA Rates | paultan.org/2025/12/26/..., paultan.org/2026/02/03/... | Monthly AFA tracking |

### Post-2025 policy sources

| Source | URL | Content |
|---|---|---|
| PETRA Statement (1 Jul 2025) | soyacincau.com/2025/07/01/petra-malaysia-home-solar-energy-offset-nem-july-2025/ | NEM offset retention under new tariff |
| PETRA Statement (Lowyat) | lowyat.net/2025/357352/petra-rooftop-solar-offsets-to-continue/ | Energy + capacity + network offset confirmed |
| pv magazine (2 Jul 2025) | pv-magazine.com/2025/07/02/malaysia-upgrades-net-metering-scheme-for-rooftop-pv/ | NEM scheme update, 700 MW quota |
| SolarQuarter (3 Jul 2025) | solarquarter.com/2025/07/03/malaysia-extends-solar-credit-scheme-for-over-96000-rooftop-users/ | 12-month settlement uniformity |

### Solar irradiance sources

| Source | Content |
|---|---|
| PVsyst Meteonorm (ResearchGate 2023 study) | Monthly GHI data for Malaysia; basis for distribution factors |
| IEN Consultants, Kuala Lumpur | 1,200 kWh/kWp standard for KL |
| Malaysian Meteorological Department (1993–2002 Subang data) | 4.39 kWh/m²/day average; ground-truth reference |
| Shavalipour et al. 2013, Int. J. Photoenergy | Monthly irradiance range for Peninsular Malaysia |
| SEDA PVMS | pvms.seda.gov.my — live monitoring of 150+ systems |

### Key uncertainties flagged for future verification

1. **EEI adjustment for NEM users:** PETRA stated rates "will be adjusted" but no details published. Monitor seda.gov.my and st.gov.my.
2. **SST calculation base under RP4:** Exact components included in the SST base have not been explicitly published for the new tariff. The algorithm above uses the most reasonable interpretation (SST on total pre-tax bill + RE Fund).
3. **RE Fund (KWTBB) base:** Whether EEI rebate is deducted from the RE Fund calculation base is not definitively documented. The algorithm above does not deduct EEI from the RE Fund base (conservative approach).
4. **Capacity limits post-May 2025:** Two secondary sources cite 5 kWac / 12.5 kWac but no official SEDA document confirms. Use 4 / 12.5 kW (three-phase) as validated defaults.
5. **March 2026 AFA rate:** Not yet announced as of 2 March 2026. Algorithm requires monthly updates.

### Old tariff (pre-July 2025) — retained for reference only

| Block | kWh range | Rate (sen/kWh) |
|---|---|---|
| 1 | 1–200 | 21.80 |
| 2 | 201–300 | 33.40 |
| 3 | 301–600 | 51.60 |
| 4 | 601–900 | 54.60 |
| 5 | 901+ | 57.10 |

Minimum charge: RM3.00. This structure is no longer in effect and should not be used in the MVP unless explicitly modelling pre-July 2025 billing periods.

## Assumptions & Config (to prevent hardcoding policy details)

    The following items **must be configurable** (do not hardcode), because they may change over time or depend on the official tariff schedule in force:

    - `tariff_version` (e.g., TNB Domestic RP4 / post-restructure)
    - `energy_tiers` (thresholds + sen/kWh rates)
    - `energy_rate_mode` (`"block"` default; alternate `"threshold_all"` if officially confirmed later)
    - `afa_sen_per_kwh` (default 0; update when you have a trusted official value)
    - `sst_rate` and `sst_applicability_rule`
    - Any waivers/discount rules that are tariff-version dependent (e.g., retail charge waiver threshold)

    **MVP rule:** when the source is not a regulator/utility PDF, label the rule as an assumption and keep it in config.