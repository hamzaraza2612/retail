# Business Workflow

How a unit of chicken moves through the system, from supplier to cash in hand.

```
Supplier → Purchase → Inventory → Sales Order → Invoice → Payment → Delivery → Customer Ledger
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

## 3. Sales Order

A Sales user creates an **Order** (`POST /api/orders`) for a customer with line items,
discount and delivery charges. The order starts as **Draft** — nothing else happens yet:
no stock is touched, no invoice exists, no customer balance changes. This lets staff build
up an order (e.g. over a phone call) without committing it.

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
`RETURN_IN` movement, the customer's balance is reduced back down, and `StockDeducted` is
cleared. A **Draft** order can simply be cancelled with no side effects since nothing was
committed yet. Cancelled orders are kept, not deleted — they remain visible for audit.

## 4. Invoice

The invoice generated on confirmation carries its own copy of the order's amounts
(subtotal, discount, delivery charges, grand total, paid, balance) so it stays a stable
record even if, hypothetically, the order were edited later. It's rendered as a clean,
printable A4 page (`/invoices/{id}/print`) with the business header, line items and
payment status, ready to hand to the customer or print from the browser.

## 5. Payment

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

## 6. Delivery

Once an order is confirmed, a **Delivery** can be created and assigned to a driver
(from Employees). Its status (Pending → Assigned → Out for Delivery → Delivered/Failed)
is tracked independently of the order status, though marking a delivery **Delivered**
also advances the linked order to **Delivered** if it hasn't reached that state yet.

## 7. Customer Ledger

Every customer and supplier has a running account statement
(`/api/customers/{id}/statement`, `/api/suppliers/{id}/statement`) built from their
opening balance plus every invoice/payment (or purchase/payment) in date order, so the
"why is this balance what it is" question always has a paper trail — this is the same
data the dashboard's receivables/payables totals are aggregated from.

## Everything is audited

Every one of the above mutations — login, create/update/deactivate, purchase, sale
confirmation/cancellation, payment, stock adjustment, expense, delivery status change —
writes an `AuditLog` row (who, what, when, on which record) via `AuditService`, visible to
Admin/Manager under **Audit Logs**. Because several workers share this system day to day,
this is the record of who did what.
