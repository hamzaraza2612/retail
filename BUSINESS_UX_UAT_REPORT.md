# Business UX UAT Report

**Date:** 2026-09-30
**Scope:** End-to-end verification of the "Simplify ___" / mobile-responsive / terminology-cleanup UX work performed on this branch (`claude/jolly-brahmagupta-hm1n3w`), against a real business scenario run through the actual UI on a clean Docker deployment.
**Result: PASS** — no genuine regressions found. One pre-existing (not introduced by this work) display bug found and documented below; not fixed, per this task's "fix only genuine regressions caused by these UX changes" instruction.

---

## 1. Environment & Build Verification

| Check | Result |
|---|---|
| Docker clean rebuild (`down -v`, image rebuild from current source, fresh Postgres volume) | **PASS** — both `retail-api` and `retail-frontend` images rebuilt from current source. (Note: this sandbox's Docker daemon cannot reach the outbound package registries directly — a documented, sandbox-only limitation, worked around per `/root/.ccr/README.md`'s own suggested fix: build with `--network=host` and a temporary CA-trust step, applied only for this verification build and fully reverted afterward — `git diff` on both Dockerfiles is empty. Not a product issue; a real deployment host has normal internet access.) |
| Docker startup, all 3 containers healthy | **PASS** — `chicken_postgres`, `chicken_api`, `chicken_frontend` all report healthy |
| Backend build (`dotnet build`) | **PASS** — 0 warnings, 0 errors |
| Backend test suite (`dotnet test`) | **PASS** — 41/41 |
| Frontend typecheck (`tsc -b --noEmit`) | **PASS** — clean |
| Frontend production build (`npm run build`) | **PASS** — clean |
| Frontend test suite (`npx vitest run`) | **PASS** — 73/73 |
| Browser smoke test | **PASS** — full app reachable and usable end-to-end through the dockerized frontend at the container's own served URL |

No code changes were made as part of this task — the git tree is unchanged (only the pre-existing, intentionally-untracked `BUSINESS_UX_AUDIT.md` remains untracked).

---

## 2. End-to-End Business Scenario (run live through the UI)

Run against a freshly-seeded database (fresh `docker compose down -v` + `up`), logged in as `admin`, driven entirely through the deployed frontend — no API calls used except where explicitly noted for defense-in-depth checks.

### 2.1 Purchase — 500 KG raw chicken

- New Purchase → Supplier: ABC Poultry Farm → Product: Raw Chicken (Whole Bird, default) → Quantity: 500 → Payment Status: Paid.
- **Result:** "Raw Chicken (Whole Bird) Added — 500 KG", Total **Rs. 275,000**, Supplier Balance **Rs. 247,736** (unchanged — paid in full).
- Cross-checked in Postgres: `Products.CurrentStock` for Raw Chicken = 500.00 immediately after. **PASS**

### 2.2 Cutting — 500 KG input

Boneless 150 / Breast 70 / Tikka 80 / Leg 90 / Wings 50 / Neck 20 / Whole Chicken 20 / Waste 20.

- Live preview showed **BALANCED**, Difference **0.000 KG**, Yield **96%** before submission, exactly matching the required `500 = 480 + 20` check.
- **Result:** "Raw Chicken Consumed 500 KG", "Finished Stock Added 480 KG", "Waste 20 KG", "Estimated Cost/KG Rs. 573" (= Rs. 275,000 ÷ 480 KG = 572.92, weight-based allocation, confirmed correct).
- Cross-checked in Postgres: Raw Chicken stock → 0.00; every finished product's stock increased by exactly its input KG; every finished product's `PurchasePrice` updated to **572.92** (the shared weight-based unit cost). **PASS**
- Cross-checked in the **Yield Report** (Processing/Yield quick report): shows two batches today, both `500 / 480 / 20 / 96%` (the second being this run's batch, the first a pre-seeded demo batch with an identical recipe — legitimate, not a duplicate bug). **PASS**

### 2.3 Sales

**Hotel credit sale — 50 KG Boneless, to Hotel Grand View (Hotel-type customer):**
Invoice **INV-2026-00007**, Total **Rs. 37,500**, Paid **Rs. 0**, Remaining **Rs. 37,500**. Hotel's Amount Due became Rs. 37,500. **PASS**

**Cash sale — 10 KG Boneless:**
Invoice **INV-2026-00008**, Total **Rs. 7,500**, Paid **Rs. 7,500** (auto-filled to Net Total), Remaining **Rs. 0**. Printed invoice checked — see §4. **PASS**

Boneless Chicken stock after both sales: 300 − 50 − 10 = **240 KG**, confirmed on the Stock page and in Postgres. **PASS**

### 2.4 Payment — partial hotel payment

Customer → Hotel Grand View → Receive Payment → Rs. 15,000 (of Rs. 37,500 due).
**Result:** "Payment Received", Amount Rs. 15,000, Remaining Due **Rs. 22,500**. Customer detail's Amount Due stat card and the Ledger Summary's "Current Due" both immediately showed **Rs. 22,500**, matching each other and the Customer Due report. **PASS**

---

## 3. Verification Matrix

All figures below were read from the running UI after the scenario completed and independently cross-checked against direct Postgres queries.

| Item | UI value | Cross-check | Result |
|---|---|---|---|
| Stock (Raw Chicken) | 0 KG | `Products.CurrentStock` = 0.00 | PASS |
| Stock (Boneless Chicken) | 240 KG | `Products.CurrentStock` = 240.00 | PASS |
| Stock (Finished Product total, Dashboard) | 2,748 KG | Manually summed across all 17 products = 2,748 | PASS |
| Invoices | INV-2026-00007 (Rs. 37,500, unpaid) / INV-2026-00008 (Rs. 7,500, paid) | `Invoices` table matches exactly | PASS |
| Cash (Dashboard "Cash Received") | Rs. 7,500 | = today's walk-in/cash-customer sales only (by design — see §5) | PASS |
| Receivable (Dashboard "Customer Due") | Rs. 70,991 | Sum of all customers' `CurrentBalance` = 70,990.70 ≈ 70,991 | PASS |
| Customer ledger (Hotel Grand View) | Amount Due Rs. 22,500 ≡ Ledger "Current Due" Rs. 22,500 | `Customers.CurrentBalance` = 22,500.00 | PASS |
| COGS (via Product Profit report) | Boneless: 60 KG sold, Estimated Cost Rs. 34,375.2 | 60 × 572.9167 = 34,375.00 (rounding) | PASS |
| Estimated Gross Profit (Dashboard) | Rs. 10,625 | Revenue 45,000 − COGS 34,375 = 10,625 | PASS |
| Expenses (Dashboard "Today's Expenses") | Rs. 3,200 | Pre-seeded demo expense records dated today | PASS (pre-existing data, not from this scenario) |
| Estimated Operating Result (Dashboard) | Rs. 7,425 | Gross Profit 10,625 − Expenses 3,200 = 7,425 | PASS |
| Today's Dashboard | All 10 cards render correctly, no truncation at 1440px | — | PASS |
| Stock Report / Stock page | Boneless 240 KG, Leg 180 KG, Neck 40 KG, Tikka 160 KG, Raw Chicken 0 KG (Low Stock) all shown | Matches Postgres | PASS |
| Customer Report ("Customer Due" quick report) | Hotel Grand View Rs. 22,500 (+ 3 pre-existing customers) | Sums to the Dashboard's Rs. 70,991 | PASS |
| Processing Report ("Processing/Yield" quick report) | Both batches 500/480/20/96% | Matches §2.2 | PASS |

Every figure checked reconciles exactly against the database. No inventory, ledger, or financial calculation defect was found anywhere in the scenario.

---

## 4. Invoice

Printed the cash-sale invoice (INV-2026-00008) via Sales → order detail → "View / Print Invoice". Confirmed: Business Name, Invoice Number, Date, Customer ("Walk-in / Cash Customer", no leaked placeholder phone), Items table (Quantity/Rate/Amount), Subtotal, Discount, **Net Total**, Paid, **Balance Due** (shown in green, Rs. 0, correctly not alarming for a fully-paid invoice), Status "Paid in Full". No internal database IDs visible anywhere on the page. **PASS**

---

## 5. Edge Case Testing

| Case | Steps | Result |
|---|---|---|
| **Cancellation** | Cancelled the cash sale (SO-2026-00008, "Mark as Cancelled") | Order → `Cancelled`/`Paid`/RemainingAmount=0; its invoice zeroed out (Subtotal/GrandTotal/Paid/Balance all 0, status Paid) rather than deleted — preserves the invoice number/audit trail while removing the "ghost debt", exactly as documented in the code. Boneless stock correctly restored 240→250 KG. **PASS** |
| **Insufficient stock** | New Sale → Chicken Feet (0 KG on hand) × 10 | Rejected with a clear stock-availability error; the draft order was cleaned up automatically (confirmed: 0 orphaned Draft sales orders in the DB afterward); the form remained open and usable for retry. **PASS** |
| **Overpayment** | Receive Payment on Hotel Grand View (Rs. 22,500 due) → tried Rs. 9,999,999 | Rejected client-side ("cannot exceed the current outstanding balance"); nothing was submitted; form stayed open. **PASS** |
| **Duplicate submit** | Rapid double-click "Save Purchase" | Exactly one purchase record created (confirmed in Postgres) on each of two separate attempts — the button disables/the form transitions away before a second click can land. **PASS** |
| **Role permissions** | Logged in as `sales`, `storekeeper`, `cashier`, `delivery` and checked Dashboard Quick Actions | `sales`: sees New Sale/Receive Payment/Customer Ledger, not New Purchase/Cutting. `storekeeper`: sees New Purchase/Cutting, not New Sale/Receive Payment/Add Expense. `cashier`: sees Receive Payment/Add Expense, not New Sale/New Purchase/Cutting. `delivery`: sees none of the six restricted actions. All exactly match the backend's `[Authorize(Roles=...)]` attributes. Also confirmed server-side (not just UI-hidden): a `storekeeper`'s bearer token calling `POST /api/orders` directly returns **403**. **PASS** |

---

## 6. Mobile Navigation

Checked at 375px width: hamburger opens a clean sliding drawer with a dimmed backdrop, all primary nav items present and readable, active route highlighted, closes correctly on navigation. No horizontal overflow (`document.documentElement.scrollWidth === clientWidth` at every width checked). **PASS**

---

## 7. Changed Workflows Covered by This UAT

Every workflow touched by the "Simplify ___" series, the mobile-responsive pass, and the terminology cleanup was exercised live in this scenario: Dashboard, New Purchase, Chicken Cutting, New Sale (both cash and credit), Receive Payment, Customer detail/ledger, Stock, Reports (Today's Business/Stock/Customer Due/Product Profit/Processing-Yield/Cash vs Credit quick reports), Invoice print, Sales order detail/cancellation, and role-gated navigation.

---

## 8. Remaining Issues

**One display bug found, not introduced by this work, not fixed here (see below).**

- **Cash vs Credit Sales report shows order counts formatted as currency.** The "Cash Order Count" and "Credit Order Count" tiles read e.g. **"Rs. 1"** / **"Rs. 7"** instead of plain counts. Root cause: `reports/Reports.tsx`'s generic object-report renderer formats *every* numeric field as money (`typeof v === "number" ? formatMoney(v) : String(v)`) — this line predates all of this session's work and was not touched by it; it was simply made easier to reach by this session's new one-click "Cash vs Credit" quick-report tile. Per this task's instruction to fix only genuine regressions caused by these UX changes, this was left as-is and is reported here for a follow-up fix (a one-line addition to the existing `FIELD_LABEL_OVERRIDES`-style mechanism in the same file would resolve it).

No other issues — display, calculation, navigation, or authorization — were found.

---

## 9. Known Limitations (pre-existing, documented for completeness)

- **Estimated profit, not accounting-grade profit.** Every "Estimated Gross Profit"/"Estimated Operating Result" figure in the app is derived from the *current* `Product.PurchasePrice` at the moment stock moves — a weight-based average, not lot-level/FIFO costing. This is by design (documented in `BUSINESS_WORKFLOW.md`) and is labeled "Estimated" everywhere it appears.
- **Product Profit report shows Rs. 0 cost for very old sales.** Sales recorded before the historical cost-snapshot field existed have no `UnitCost` on their inventory movement and so show Rs. 0 estimated cost/profit for that line — a known, already-documented limitation of historical seed data, not something this scenario's own sales exhibited (Boneless Chicken's cost/profit for this scenario's sales both computed correctly).

---

## Screenshots

Captured during this run (21 core scenario screenshots + role/mobile checks), covering: initial Dashboard, Purchase form/result, Cutting form/result, both New Sale flows, Receive Payment before/after, final Dashboard, Stock page, all four Quick Reports, order detail, printed invoice, cancellation, insufficient-stock and overpayment rejections, and per-role Dashboards. A representative selection was sent alongside this report.
