# Chicken Wholesale & Supply — Business Management System

A complete business management application for a chicken wholesale & supply operation:
customers, suppliers, products, purchases, inventory, sales orders, invoices, payments,
deliveries, employees, expenses, reports, users/roles and an audit log — all backed by a
real relational database, not mock screens.

## Architecture

```
retail/
├── backend/                  ASP.NET Core 8 Web API + EF Core + PostgreSQL
│   ├── src/ChickenWholesale.Api/
│   │   ├── Models/            Entity classes (Customer, Product, SalesOrder, ...)
│   │   ├── Data/               ApplicationDbContext + DbSeeder (demo data)
│   │   ├── DTOs/                Request/response contracts
│   │   ├── Controllers/         REST endpoints (one per module)
│   │   ├── Services/             JWT, audit log, code generator, inventory engine
│   │   └── Middleware/            Global exception handling
│   └── tests/ChickenWholesale.Tests/   xUnit tests for core business logic
├── frontend/                 React 19 + Vite + TypeScript + Tailwind CSS
│   └── src/
│       ├── api/                Typed API client (axios) + DTO types
│       ├── auth/                 JWT auth context
│       ├── components/            Sidebar layout, shared UI kit (table, modal, etc.)
│       └── pages/                  One folder per module
├── docker-compose.yml
└── .env.example
```

**Stack**
- Backend: ASP.NET Core 8 Web API, Entity Framework Core, PostgreSQL, JWT auth, BCrypt password hashing.
- Frontend: React + Vite + TypeScript + Tailwind CSS, React Router, Recharts, react-hot-toast.
- Infra: Docker Compose (postgres, api, frontend/nginx).

Deliberately **not** used: microservices, message buses, CQRS, Kubernetes. This is a single
modular monolith sized for one wholesale business, not a distributed platform.

## Requirements

- Docker + Docker Compose (recommended way to run the app)
- For local (non-Docker) development: .NET 8 SDK, Node.js 20+, PostgreSQL 14+

## Quick Start (Docker)

```bash
cp .env.example .env      # edit passwords/secrets for anything beyond local testing
docker compose up -d --build
```

This starts three containers, each with a Docker healthcheck (`docker compose ps` shows
`healthy` once ready — `frontend` waits on `api`, `api` waits on `postgres`):
- `chicken_postgres` — PostgreSQL 16, persisted in the `postgres_data` volume
- `chicken_api` — the Web API on port `8080` (runs EF Core migrations and seeds demo data automatically on first startup)
- `chicken_frontend` — the built React app served by nginx on port `8081`, which reverse-proxies `/api/*` to the API container

All three restart automatically (`restart: unless-stopped`) if they crash or the host reboots.

Open **http://localhost:8081** and sign in with one of the demo accounts below.

To stop: `docker compose down` (add `-v` to also drop the database volume).

`POSTGRES_PORT` (default `5432`) is published to the host mainly so you can run the backup
commands below or connect a GUI client directly; on a hardened production host with no
need for that, remove the `ports:` mapping under `postgres:` in `docker-compose.yml` so the
database is only reachable from the `api` container over the internal Docker network.

## Demo Login Credentials

Seeded automatically on first run:

| Username     | Password     | Role         |
|--------------|--------------|--------------|
| admin        | Admin@123    | Admin        |
| manager      | Manager@123  | Manager      |
| sales        | Sales@123    | Sales        |
| cashier      | Cashier@123  | Cashier      |
| storekeeper  | Store@123    | Store Keeper |
| delivery     | Delivery@123 | Delivery     |

Seed data also includes 10 customers, 5 suppliers, 15 chicken products, sample purchases,
sales orders, invoices, payments and expenses so every screen has real data to show from
the first login.

## Environment Variables

See `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials |
| `CONNECTION_STRING` | Full Npgsql connection string used by the API container |
| `JWT_KEY` | Secret used to sign JWTs — **change this in any non-local deployment**. The API refuses to start with `ASPNETCORE_ENVIRONMENT=Production` (the Docker default) if this is missing, under 32 characters, or still the placeholder from `.env.example` — generate one with `openssl rand -base64 48` |
| `JWT_EXPIRY_HOURS` | Token lifetime |
| `CORS_ALLOWED_ORIGINS` | Origins allowed to call the API directly (only relevant if you bypass the nginx proxy) |
| `API_PORT` / `FRONTEND_PORT` | Host ports the containers are published on |
| `VITE_API_URL` | Base URL the frontend calls; `/api` (default) relies on nginx proxying to the `api` container |

Never commit a real `.env` file — only `.env.example` is checked in.

## Local Development (without Docker)

**Backend**
```bash
cd backend
dotnet tool install --global dotnet-ef   # first time only
# Point ConnectionStrings:DefaultConnection (appsettings.Development.json or env var)
# at a local PostgreSQL instance, then:
dotnet ef database update --project src/ChickenWholesale.Api --startup-project src/ChickenWholesale.Api
dotnet run --project src/ChickenWholesale.Api --urls http://localhost:5080
```
Migrations and demo seed data run automatically on startup (`DbSeeder.SeedAsync`), the
same as in Docker.

**Frontend**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, calls http://localhost:5080/api (see .env.development)
```

## Database Migrations

EF Core migrations live in `backend/src/ChickenWholesale.Api/Migrations`. To add a new one
after changing an entity:
```bash
cd backend
dotnet ef migrations add <Name> --project src/ChickenWholesale.Api --startup-project src/ChickenWholesale.Api
```
Migrations apply automatically on API startup (both locally and in Docker) — no manual
`database update` step is required in normal operation.

## Running Tests

Tests run against a real, disposable PostgreSQL database (not the EF Core InMemory
provider) — a Postgres server needs to be reachable at `localhost:5432` with a `postgres`
superuser whose password matches `change-me-strong-password` (the compose default), or edit
the maintenance connection string in `tests/ChickenWholesale.Tests/TestHelpers.cs`. The
easiest way to get one is the project's own `docker compose up -d postgres`. Each test
creates and uses its own throwaway database (`test_<guid>`), so tests are fully isolated
and safe to run in any order; they are not cleaned up automatically afterward.

```bash
docker compose up -d postgres   # if it isn't already running
cd backend
dotnet test
```

Covers the business-critical paths: customer/product creation, purchase increasing stock,
sales order confirmation decreasing stock **exactly once** (idempotency), rejecting an
invalid or repeated status transition, negative-stock prevention, order total calculation,
customer payments reducing receivables (and rejecting an overpayment against a specific
invoice), supplier payments reducing payables, deactivated customers/products being
rejected from new orders, and — run against real concurrent requests, not simulated — two
workers racing to confirm the same order, where exactly one may succeed.

This deliberately uses a real database instead of InMemory: the concurrency-safety fixes
compile to real atomic SQL (`ExecuteUpdateAsync`) that the InMemory provider can't
translate, and InMemory has no row-locking semantics to meaningfully test a race against
regardless.

## API Overview

All endpoints are under `/api`, JWT-protected unless noted, JSON in/out. Full list is
browsable via Swagger at `http://localhost:8080/swagger` when running.

```
POST   /api/auth/login                     Public — returns a JWT
GET    /api/auth/me

GET    /api/dashboard                      KPI cards, 7-day charts, recent activity

GET    /api/customers                      Search, filter, paginate
POST   /api/customers
GET    /api/customers/{id}                 Balance, totals, order/payment history
GET    /api/customers/{id}/statement        Full account ledger
PUT    /api/customers/{id}
DELETE /api/customers/{id}                  Deactivates (soft delete)

GET/POST/PUT/DELETE /api/suppliers          Same shape as customers, plus /statement

GET/POST/PUT/DELETE /api/products
GET    /api/products/categories

POST   /api/purchases                      Supplier + items → increases stock,
                                            creates payable, logs inventory movement
GET    /api/inventory/dashboard
GET    /api/inventory/movements
POST   /api/inventory/adjust               Manual stock correction / waste / return

POST   /api/orders                         Creates a Draft order (no stock impact yet)
PUT    /api/orders/{id}/status              Draft→Confirmed deducts stock once and
                                            generates the invoice; Cancelled restores it
GET    /api/invoices/{id}                   Printable invoice data

POST   /api/payments                       Customer payment, reduces receivable
POST   /api/supplier-payments               Supplier payment, reduces payable

GET/POST/PUT   /api/deliveries
PUT    /api/deliveries/{id}/status

GET/POST/PUT/DELETE /api/employees
GET/POST /api/expenses

GET    /api/reports/{report-name}          daily-sales, monthly-sales, sales-by-customer,
                                            sales-by-product, purchases, receivables,
                                            payables, inventory, expenses, profit-summary,
                                            payments, deliveries — all accept ?format=csv

GET/POST/PUT/DELETE /api/users             Admin only
GET    /api/audit-logs                     Admin/Manager only
```

## Role-Based Access

Enforced on the backend (`[Authorize(Roles = "...")]`), not just hidden in the UI:

| Role | Access |
|---|---|
| Admin | Everything, including Users and Audit Logs |
| Manager | Dashboard, Reports, Sales, Purchases, Inventory, Customers, Employees |
| Sales | Customers, Orders, Invoices, Payments |
| Cashier | Payments, Customers, Invoices, Expenses |
| Store Keeper | Inventory, Purchases, Stock Adjustments, Suppliers |
| Delivery | Assigned deliveries and delivery status updates |

## Backup & Restore (PostgreSQL)

**Backup:**
```bash
docker exec chicken_postgres pg_dump -U postgres chickenwholesale > backup_$(date +%Y%m%d).sql
```

**Restore** (into a running, empty database):
```bash
cat backup_20260101.sql | docker exec -i chicken_postgres psql -U postgres -d chickenwholesale
```

Restoring into the live database name requires it to be empty first (drop and recreate it,
or restore into a fresh database as shown below) — `psql` will otherwise emit duplicate-key
errors partway through and leave the target in a mixed state.

**These exact commands were run against this project's own seeded data** as part of
production-readiness verification: `pg_dump` produced a ~50KB SQL file, it was restored into
a separate `restore_test_db` database on the same Postgres instance, and every table's row
count (`Users`, `Customers`, `Suppliers`, `Products`, `Purchases`, `SalesOrders`, `Invoices`,
`Payments`, `Employees`, `Expenses`, `AuditLogs`) plus a spot-check of actual row content
(customer balances, a user's bcrypt password hash) matched the source database exactly
before the test database was dropped. No manual data-fixing was required.

For anything beyond ad-hoc local backups, schedule `pg_dump` via cron and store the output
off-host.

## Data Safety Notes

- Financial records (purchases, orders, invoices, payments) are never hard-deleted —
  customers/suppliers/products/employees/users are deactivated instead, and orders are
  cancelled rather than removed.
- Purchase → stock increase → payable creation, and Sale confirmation → stock decrease →
  invoice → receivable, each run inside a single database transaction, so partial writes
  can't happen.
- Confirming a sales order is idempotent: a `StockDeducted` flag on the order guards
  against deducting the same order's stock twice if the status is changed again.
- Negative stock is rejected by default (`InventoryService.ApplyMovementAsync`) unless a
  call explicitly opts into `allowNegative` (used only for purchases, which can only ever
  increase stock).
- All money columns are `decimal`, never floating point.
- **Concurrency-safe balance and stock updates.** Stock deduction (`InventoryService`) and
  every customer/supplier balance change (`LedgerService`) compile to a single atomic SQL
  `UPDATE ... SET col = col + @delta [WHERE cap-check]` via EF Core's `ExecuteUpdateAsync`,
  rather than reading a value into memory and writing it back. This closes the classic
  "Worker A and Worker B both read stock=100, both sell 80" lost-update race: Postgres
  row-locks on `UPDATE` and re-evaluates the `WHERE` clause against the latest committed
  row, so a second concurrent oversell/overpayment attempt affects 0 rows and is rejected
  instead of corrupting the total. `SalesOrdersController.UpdateStatus` uses the same
  pattern (an atomic conditional status transition) to make order confirmation/cancellation
  safe against a double-click or two workers acting on the same order at once — the loser
  gets `409 Conflict`, never a duplicate invoice or double stock deduction. This is
  exercised directly by `ConfirmSalesOrder_ConcurrentDoubleConfirm_OnlyOneSucceeds` in the
  test suite, which fires two real concurrent requests against Postgres.
- **Order status transitions are validated server-side**, not just hidden in the UI — a
  fixed table in `SalesOrdersController` is the only source of truth for which status
  changes are legal (e.g. `Draft → Delivered` directly, skipping stock deduction and
  invoicing, is rejected regardless of how the request is made).
- Orders and purchases cannot be created against a deactivated customer, supplier, or
  product.

## Known Limitations (by design, for a 2-day MVP)

- "Estimated Gross Profit" uses recorded purchase price as COGS — it is an estimate, not a
  reconciled accounting figure, and is labelled as such in the UI.
- No WhatsApp/SMS integration, no payroll module, no route optimization — these are
  explicitly out of scope for the MVP (see the task brief's P2 list).
- Human-readable sequential codes (`CUST-2026-00010`, `PO-2026-00004`, ...) are generated
  from a dedicated Postgres `SEQUENCE` per entity type (`nextval()`), which is atomic at
  the database level — concurrent requests creating the same kind of record cannot collide
  on the same code, with no locking or retry logic needed. Verified with an automated test
  that fires many concurrent creations and asserts every generated code is unique.
- The `Delivery` role only sees and can update deliveries assigned to it: each `User` with
  the `Delivery` role is linked to an `Employee` record (`Users.EmployeeId`), and the
  delivery list/detail/status-update endpoints filter or reject by that link server-side
  (not just hidden in the UI) — a delivery worker cannot view or modify another worker's
  delivery by guessing its ID.
- No token revocation/blacklist — logging out clears the token client-side only; a stolen
  JWT remains valid until it expires (`JWT_EXPIRY_HOURS`, default 12h). Changing a user's
  password (self-service or an admin's "Reset Password") stamps `PasswordChangedAt`, which
  is embedded in every token issued afterward and re-checked by middleware on every
  authenticated request — so **any token issued before that password change stops working
  immediately**, even though it hasn't technically expired yet. This narrows the "stolen
  token" window to "until the token expires or the owner/an admin changes the password,"
  without a distributed session/blacklist store. Deactivating a user (`IsActive = false`)
  is enforced the same way and also takes effect on the next request, not at next login.
  12 hours was chosen as a practical balance for shift-based staff (cashiers, sales, store
  workers) who shouldn't have to re-login mid-shift, while still bounding a leaked token's
  useful life to about a business day; override with `JWT_EXPIRY_HOURS` per deployment.
- The sidebar layout is desktop-first without a mobile collapse/hamburger menu.

See also [`BUSINESS_WORKFLOW.md`](./BUSINESS_WORKFLOW.md) for how the modules connect end to end.
