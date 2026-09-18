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

This starts three containers:
- `chicken_postgres` — PostgreSQL 16, persisted in the `postgres_data` volume
- `chicken_api` — the Web API on port `8080` (runs EF Core migrations and seeds demo data automatically on first startup)
- `chicken_frontend` — the built React app served by nginx on port `8081`, which reverse-proxies `/api/*` to the API container

Open **http://localhost:8081** and sign in with one of the demo accounts below.

To stop: `docker compose down` (add `-v` to also drop the database volume).

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
| `JWT_KEY` | Secret used to sign JWTs — **change this in any non-local deployment** |
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

```bash
cd backend
dotnet test
```

Covers the business-critical paths: customer/product creation, purchase increasing stock,
sales order confirmation decreasing stock **exactly once** (idempotency), negative-stock
prevention, order total calculation, customer payments reducing receivables, and supplier
payments reducing payables — all against an isolated in-memory database per test.

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

## Known Limitations (by design, for a 2-day MVP)

- "Estimated Gross Profit" uses recorded purchase price as COGS — it is an estimate, not a
  reconciled accounting figure, and is labelled as such in the UI.
- No WhatsApp/SMS integration, no payroll module, no route optimization — these are
  explicitly out of scope for the MVP (see the task brief's P2 list).

See also [`BUSINESS_WORKFLOW.md`](./BUSINESS_WORKFLOW.md) for how the modules connect end to end.
