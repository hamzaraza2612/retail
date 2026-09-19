# Business Workflow

How a unit of chicken moves through the system, from supplier to cash in hand.

```
Supplier → Purchase → Raw Stock → Processing → Finished Stock
    → Sales Order (Cash or Credit) → Invoice → Payment → Delivery → Customer Ledger
    → Daily Closing → Profit/Loss
```

## 1. Supplier → Purchase

A Store Keeper (or Admin/Manager) records a **Purchase** (`POST /api/purchases`):
supplier, one or more line items (product, quantity, rate), and how much was paid up
front.

On save, in a single database transaction:
- The purchase and its items are stored (`Purchase`, `PurchaseItem`).
- Each product's `CurrentStock` is increased and an `InventoryTransaction` of type
  `PURCHASE` is recorded, so the full history of *why* stock is at a given level is
  always visible.
- The supplier's `CurrentBalance` (payable) increases by `TotalAmount − PaidAmount`.
- An audit log entry is written.

## 2. Inventory

Stock levels are always derived from the transaction log (`InventoryTransaction`), not
just a bare counter — every purchase, sale, adjustment, waste, or return is a row with a
before/after quantity, so nothing silently changes stock. The Inventory dashboard surfaces
low-stock products (`CurrentStock <= MinimumStock`) and lets Store Keepers post manual
adjustments (`POST /api/inventory/adjust`) for damage, waste, or corrections — these use
the same transactional, audited path as purchases and sales, and negative stock is
rejected unless the movement is an intentional decrease with sufficient stock on hand.

## 3. Processing / Cutting & Costing

Not every product is purchased and sold as-is. Raw whole birds are bought as a
**RawMaterial** product (e.g. "Raw Chicken (Whole Bird)") and cut into **FinishedProduct**
cuts (Boneless, Breast, Tikka, Leg, Wings, Neck, Whole Chicken, ...) via a **Processing
Batch** (`POST /api/processing-batches`). This reuses the exact same `InventoryTransaction`
ledger, `Product` table, and audit log as everything else — there is no parallel inventory
or costing system.

**Product classification.** Every product has a `ProductType`: `RawMaterial` (only usable
as processing input) or `FinishedProduct` (sellable, and the only valid processing output).
All 15 products that existed before this feature default to `FinishedProduct` (they were
already being purchased and sold directly with no processing step) — see migration
`AddProcessingAndProductType`. Not every product needs to go through processing at all: a
`FinishedProduct` bought directly from a supplier and sold as-is (the original workflow)
keeps working completely unchanged.

**The batch itself.** A batch records one or more raw material inputs (product + quantity),
one or more finished-product outputs (product + quantity), and a waste quantity + reason.
It starts as **Draft** — exactly like a Sales Order, nothing touches stock yet, so staff can
build up the batch and see the running balance before committing. The UI shows Input
Total / Output Total / Waste / Difference live as you type.

**Completing a batch** (`PUT /api/processing-batches/{id}/status` → `Completed`) is the
commit point, atomic like order confirmation:
1. **Balance check**: `Input quantity` must equal `Output quantity + Waste quantity`,
   within a small rounding tolerance (0.01 KG, a named constant in
   `ProcessingBatchesController`) — real scales rarely balance to the 15th decimal place.
   A batch that doesn't balance cannot be completed (it can still be saved as a Draft while
   the numbers are being worked out).
2. **Raw material is consumed**: one `PROCESSING_OUT` inventory movement per input line,
   using the same atomic "never go negative" stock claim as every other movement
   (`InventoryService.ApplyMovementAsync`) — if two batches race to consume more of the same
   raw material than is on hand, only one can succeed (see the concurrency test
   `ConcurrentProcessing_OnlyOneSucceedsWhenCombinedExceedsRawStock`).
3. **Cost is allocated across the outputs by weight** (see formula below), and each output
   line's `UnitCost`/`AllocatedCost` is stored permanently on that `ProcessingOutput` row.
4. **Finished stock is produced**: one `PROCESSING_IN` inventory movement per output line,
   at its allocated unit cost.
5. Waste is recorded on the batch (`WasteQuantity`/`WasteReason`) but does **not** get its
   own inventory movement or product — it's not a separate SKU, it's the part of the raw
   material that became neither an output nor sellable stock. It's still fully accounted
   for in the balance check above, so it can never silently vanish or create stock.

Everything above — the balance check, both sets of stock movements, and the cost
allocation — runs in one database transaction: it all happens, or none of it does.

**Costing formula — weight-based allocation.** This app does not implement full lot-level
or FIFO/weighted-average purchase costing (see "What this costing model is not" below), so
a raw material's cost is simply its `Product.PurchasePrice` at the moment the batch is
completed (the same field every other part of the app already treats as "the current
best-known unit cost"). Given that:

```
Total allocatable cost = Σ (input quantity × input unit cost)
Usable output quantity = Σ (output quantity)          [waste is excluded]
Base cost per KG        = Total allocatable cost / Usable output quantity
Each output's cost      = its quantity × base cost per KG
```

Worked example (the seeded demo data uses exactly this):

```
500 KG raw chicken @ Rs. 550/KG  = Rs. 275,000 total cost
Outputs: Boneless 150, Breast 70, Tikka 80, Leg 90, Wings 50, Neck 20, Whole 20  = 480 KG usable
Waste: 20 KG                                                    (500 = 480 + 20 ✓ balanced)

Base cost/KG = 275,000 / 480 = Rs. 572.9167/KG
Boneless cost = 150 × 572.9167 = Rs. 85,937.50   (and so on for each output)
```

Every finished product ends up costed at the *same* per-KG rate within one batch — the
model does not (and has no data to) claim that Breast is intrinsically more expensive to
produce than Wings. This is stated plainly rather than invented.

The completed batch also updates the output product's `PurchasePrice` to this new base
cost, so it becomes the new "current best-known cost" for that product going forward —
exactly as if it had just been "purchased" at that rate. This never rewrites history: see
"Cost history" below.

**What this costing model is not:**
- Not FIFO or weighted-average across multiple purchases of the same raw material — if raw
  stock came from two purchases at different prices, `Product.PurchasePrice` reflects
  whichever was set most recently (the same simplification the app already made for
  regular purchases, which never automatically averaged `PurchasePrice` either).
- Not differentiated by cut — Boneless and Wings from the same batch get the same per-KG
  cost, never a "premium cut" adjustment.
- An estimate, always labelled as such in reports (see "Daily Profit/Loss" below).

**Important operational note — keep `PurchasePrice` current.** Because the raw material's
cost basis at completion time is simply `Product.PurchasePrice`, and purchases never
auto-update that field (see "Cost history" below), if the market rate for raw chicken
changes, a store keeper must open the Products screen and update the raw material's
`PurchasePrice` **before** completing the next processing batch — otherwise the batch will
be costed at the old, stale rate. This is not a bug; it is a consequence of the app not
implementing FIFO/weighted-average purchase costing, listed as a known limitation below.

**Reversing a batch.** Cancelling a **Draft** batch is free (nothing was ever touched).
Cancelling a **Completed** batch restores the raw material and removes the produced
finished stock — but only if none of that batch's output has been sold or otherwise moved
out of stock yet. Because finished stock is a single fungible pool per product with no
per-batch/lot tracking, the app cannot know for certain which specific units a later sale
consumed — so, conservatively, if *any* sale (or waste/adjustment/further processing) of
a product has happened since a batch's output joined that product's stock, cancelling that
batch is rejected outright, even if enough *unrelated* stock (from another batch, or a
direct purchase) happens to still be sitting in the pool. A real UAT run with two same-day
batches both producing Boneless Chicken caught the earlier, looser version of this check —
which only verified that the reversal wouldn't take stock negative — silently allowing a
cancellation after part of that exact batch's output had already been invoiced to a
customer. Data integrity over cancellation convenience: cancel is for catching a mistake
immediately after completing a batch, before anything of that product has moved — not a
tool for editing processing history after the fact.

**Raw vs. finished stock** are shown separately everywhere it matters: the Inventory page
splits stock into a "Raw Material Stock" and "Finished Product Stock" panel with their own
totals, the Products page has a Type column and filter, and the Dashboard shows raw vs.
finished stock value as separate figures.

## 4. Sales Order — Cash and Credit

A Sales user creates an **Order** (`POST /api/orders`) for a customer with line items,
discount and delivery charges. The order starts as **Draft** — nothing else happens yet:
no stock is touched, no invoice exists, no customer balance changes. This lets staff build
up an order (e.g. over a phone call) without committing it.

**Cash retail vs. credit sales are the same code path**, distinguished only by which
customer the order is against — there is no separate "cash sale" endpoint or workflow to
maintain. Every environment seeds one standing customer, **Walk-in / Cash Customer**
(`CustomerCode = "CASH-001"`), for retail counter sales that don't warrant creating a full
customer profile:
- A **cash sale** is an ordinary order against `CASH-001`, confirmed and paid in full at
  the same time (`paidAmount = grandTotal`) — its `CurrentBalance` therefore always settles
  back to 0.
- A **credit sale** is an ordinary order against any other (real) customer, following the
  existing partial-payment/receivable flow described below exactly as before.

Reports and the dashboard split "cash" vs. "credit" sales purely by checking whether an
order's `CustomerId` matches the customer whose code is `CASH-001` — no new schema, no
duplicated ledger. If that customer is ever renamed or its code changed, this
classification breaks; don't rename or delete it (its record says so).

### Confirming the order

Moving the order to **Confirmed** (`PUT /api/orders/{id}/status`) is the commit point, and
runs in one transaction:
- Stock is decreased for every item (`SALE` inventory movement). If any item doesn't have
  enough stock, the whole confirmation fails and nothing is changed — no partial sale.
- An **Invoice** is generated from the order's totals.
- The customer's `CurrentBalance` (receivable) increases by the order's remaining balance.
- A `StockDeducted` flag is set on the order so that later status changes (Processing →
  Ready → Out for Delivery → Delivered) never deduct stock again — this is the safeguard
  against double-counting a single sale.

### Cancelling

Cancelling a **Confirmed** (or later) order reverses the effect: stock is restored via a
`RETURN_IN` movement, the customer's balance is reduced back down, `StockDeducted` is
cleared, and the invoice generated at confirmation time is zeroed out (its totals and
balance set to 0, marked `Paid`) rather than left behind — a UAT run caught an earlier
version of this leaving that invoice untouched, still showing its original amount as an
outstanding receivable even though the customer's real balance no longer included it. The
order itself is also updated so its own `RemainingAmount` reads 0 (the Orders screen shows
this directly), so a cancelled order never displays a contradictory "still owed" figure.
Only the invoice/order's *financial* fields are reset — `PaidAmount` (what was genuinely
collected before cancellation, if any) is left as the historical record. A **Draft** order
can simply be cancelled with no side effects since nothing was committed yet. Cancelled
orders are kept, not deleted — they remain visible for audit.

## 5. Invoice

The invoice generated on confirmation carries its own copy of the order's amounts
(subtotal, discount, delivery charges, grand total, paid, balance) so it stays a stable
record even if, hypothetically, the order were edited later. It's rendered as a clean,
printable A4 page (`/invoices/{id}/print`) with the business header, line items and
payment status, ready to hand to the customer or print from the browser.

## 6. Payment

A Cashier or Sales user records a **Payment** (`POST /api/payments`) against a customer,
optionally tied to a specific invoice. This:
- Reduces the customer's `CurrentBalance` by the payment amount.
- If tied to an invoice, updates that invoice's `PaidAmount`/`BalanceAmount`/payment
  status, and mirrors the same update onto the originating sales order.
- Is capped at the invoice's outstanding balance to prevent accidental overpayment when
  applied to a specific invoice (a general, non-invoice-tied payment is still allowed for
  advance payments).

Supplier payments (`POST /api/supplier-payments`) work identically in the other direction:
they reduce the supplier's payable and, optionally, a specific purchase's remaining
balance.

## 7. Delivery

Once an order is confirmed, a **Delivery** can be created and assigned to a driver
(from Employees). Its status (Pending → Assigned → Out for Delivery → Delivered/Failed)
is tracked independently of the order status, though marking a delivery **Delivered**
also advances the linked order to **Delivered** if it hasn't reached that state yet.

## 8. Customer Ledger

Every customer and supplier has a running account statement
(`/api/customers/{id}/statement`, `/api/suppliers/{id}/statement`) built from their
opening balance plus every invoice/payment (or purchase/payment) in date order, so the
"why is this balance what it is" question always has a paper trail — this is the same
data the dashboard's receivables/payables totals are aggregated from. The credit side of
cash-vs-credit sales (section 4) flows through exactly this ledger — a cash sale never
appears here as a receivable because it's paid in full at confirmation.

## 9. Daily Stock, Yield & Profit/Loss Reports

All of the reports below (`Reports` page, and the Dashboard's "Today's Processing &
Profit/Loss" section) are read-only views over the same `InventoryTransaction`,
`SalesOrder`, `ProcessingBatch` and `Expense` tables described above — none of them store
their own numbers, so there is nothing to keep "in sync".

- **Processing Report** (`/api/reports/processing`) — one row per batch: input/output/
  waste quantities, total allocated cost, who ran it.
- **Yield Report** (`/api/reports/yield`) — per batch, `Yield % = Usable Output ÷ Input ×
  100`. The batch detail page also shows each output's % share of that batch's total
  output.
- **Daily Stock Report** (`/api/reports/daily-stock?date=YYYY-MM-DD`) — for every product,
  a full roll-forward for the chosen date:
  ```
  Opening + Purchased + Processed In + Adjustment In + Return In
          − Sold − Processed Out − Waste − Adjustment Out − Return Out
          = Closing
  ```
  **Opening** for a date is derived, not stored: it's the sum of every signed movement
  strictly *before* that date (`CurrentStock` is always the sum of *all* movements a
  product has ever had, which the production-readiness audit's reconciliation already
  verified holds exactly). This means there is no separate "opening balance" record to
  create or maintain per day, and — importantly — **the next day's opening stock is simply
  today's closing stock**, automatically, because it's the same underlying ledger. The
  report works for any historical date, not only today.
- **Product Profit Report** (`/api/reports/product-profit`) — sold quantity, average rate,
  revenue (from `SalesOrderItem`), and estimated cost from the historical cost snapshot on
  each `SALE` inventory movement (see "Cost history" below) — not the product's current
  price, so this stays correct even after a later processing batch changes that price.
- **Daily Profit/Loss** (`/api/reports/daily-profit?date=YYYY-MM-DD`):
  ```
  Cash Sales + Credit Sales = Total Sales
  Total Sales − Estimated COGS = Gross Profit
  Gross Profit − Expenses = Operating Profit/Loss
  ```
  **"Estimated COGS" is exactly what it says**: the sum of `quantity × unit-cost-snapshot`
  for every `SALE` movement that day. It is only as accurate as the cost snapshot captured
  at the moment each sale was confirmed (see below), and — like the existing monthly
  "Estimated Gross Profit" figure this app already shipped with — it is never presented as
  a reconciled accounting number.
- **Cash vs Credit Sales** (`/api/reports/cash-vs-credit`) — the range-based version of the
  same cash/credit split used in the daily figures above.
- **Customer Outstanding** and **Closing Stock** are intentionally *not* new endpoints —
  they're exactly the existing `/api/reports/receivables` and `/api/reports/inventory`
  (today's `CurrentStock` *is* today's closing stock), reused rather than duplicated.

## 10. Cost History

Historical transactions must not silently change when a product's cost changes later — a
sale from last week must always show last week's cost, even if this week's processing
batch or product edit changed the price. Rather than adding a cost column to every
downstream table (invoices, orders, reports), the **single source of historical cost** is a
new nullable `UnitCost` column on `InventoryTransaction` — the one place a "this many units
moved at this cost" fact is already recorded for every movement type:
- `PURCHASE` — the rate actually paid on that purchase (not the product's reference price).
- `SALE` — the product's `PurchasePrice` at the exact moment of sale confirmation.
- `PROCESSING_OUT` / `PROCESSING_IN` — the raw material's cost / the allocated output cost
  for that batch (section 3).

Every report above that needs historical accuracy (Product Profit, Daily Profit/Loss)
reads this column instead of the product's *current* price. Older sales recorded before
this column existed have no snapshot and show as Rs. 0 cost in these two reports — a known
limitation of a newly-added capability, not a bug, and it does not affect the existing
"Estimated Gross Profit" figures elsewhere, which were already built on current price. This
was the smallest schema change that gave every existing and new controller a shared,
correct place to read/write cost history, instead of inventing a second ledger.

## Everything is audited

Every one of the above mutations — login, create/update/deactivate, purchase, sale
confirmation/cancellation, payment, stock adjustment, expense, delivery status change,
processing batch creation/completion/cancellation — writes an `AuditLog` row (who, what,
when, on which record) via `AuditService`, visible to
Admin/Manager under **Audit Logs**. Because several workers share this system day to day,
this is the record of who did what.
