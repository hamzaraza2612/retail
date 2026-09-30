import { api } from "./client";
import type {
  AuditLog, Customer, CustomerDetail, Delivery, DashboardData, Employee, Expense, ExpenseCategory,
  Invoice, InventoryDashboard, InventoryMovement, PagedResult, Payment, Product, ProductCategory,
  ProcessingBatch, Purchase, SalesOrder, Supplier, SupplierPayment, User,
} from "./types";

// ---------- Auth ----------
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; userId: number; username: string; fullName: string; email: string; role: string }>(
      "/auth/login", { username, password }
    ),
  me: () => api.get<User>("/auth/me"),
};

// ---------- Users ----------
export const usersApi = {
  list: () => api.get<User[]>("/users"),
  create: (data: unknown) => api.post<User>("/users", data),
  update: (id: number, data: unknown) => api.put<User>(`/users/${id}`, data),
  resetPassword: (id: number, newPassword: string) => api.post(`/users/${id}/reset-password`, { newPassword }),
  deactivate: (id: number) => api.delete(`/users/${id}`),
};

// ---------- Customers ----------
export const customersApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Customer>>("/customers", { params }),
  get: (id: number) => api.get<CustomerDetail>(`/customers/${id}`),
  orders: (id: number) => api.get(`/customers/${id}/orders`),
  payments: (id: number) => api.get(`/customers/${id}/payments`),
  statement: (id: number) => api.get(`/customers/${id}/statement`),
  create: (data: unknown) => api.post<Customer>("/customers", data),
  update: (id: number, data: unknown) => api.put<Customer>(`/customers/${id}`, data),
  deactivate: (id: number) => api.delete(`/customers/${id}`),
};

// ---------- Suppliers ----------
export const suppliersApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Supplier>>("/suppliers", { params }),
  get: (id: number) => api.get<Supplier>(`/suppliers/${id}`),
  purchases: (id: number) => api.get(`/suppliers/${id}/purchases`),
  payments: (id: number) => api.get(`/suppliers/${id}/payments`),
  statement: (id: number) => api.get(`/suppliers/${id}/statement`),
  create: (data: unknown) => api.post<Supplier>("/suppliers", data),
  update: (id: number, data: unknown) => api.put<Supplier>(`/suppliers/${id}`, data),
  deactivate: (id: number) => api.delete(`/suppliers/${id}`),
};

// ---------- Products ----------
export const productsApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Product>>("/products", { params }),
  get: (id: number) => api.get<Product>(`/products/${id}`),
  movements: (id: number) => api.get<InventoryMovement[]>(`/products/${id}/movements`),
  categories: () => api.get<ProductCategory[]>("/products/categories"),
  createCategory: (name: string) => api.post<ProductCategory>("/products/categories", JSON.stringify(name), { headers: { "Content-Type": "application/json" } }),
  create: (data: unknown) => api.post<Product>("/products", data),
  update: (id: number, data: unknown) => api.put<Product>(`/products/${id}`, data),
  deactivate: (id: number) => api.delete(`/products/${id}`),
};

// ---------- Purchases ----------
export const purchasesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Purchase>>("/purchases", { params }),
  get: (id: number) => api.get<Purchase>(`/purchases/${id}`),
  create: (data: unknown) => api.post<Purchase>("/purchases", data),
};

// ---------- Processing / Cutting ----------
export const processingBatchesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<ProcessingBatch>>("/processing-batches", { params }),
  get: (id: number) => api.get<ProcessingBatch>(`/processing-batches/${id}`),
  create: (data: unknown) => api.post<ProcessingBatch>("/processing-batches", data),
  updateStatus: (id: number, status: string) => api.put<ProcessingBatch>(`/processing-batches/${id}/status`, { status }),
};

// ---------- Inventory ----------
export const inventoryApi = {
  dashboard: () => api.get<InventoryDashboard>("/inventory/dashboard"),
  movements: (params: Record<string, unknown>) => api.get<PagedResult<InventoryMovement>>("/inventory/movements", { params }),
  adjust: (data: unknown) => api.post("/inventory/adjust", data),
};

// ---------- Sales Orders ----------
export const ordersApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<SalesOrder>>("/orders", { params }),
  get: (id: number) => api.get<SalesOrder>(`/orders/${id}`),
  create: (data: unknown) => api.post<SalesOrder>("/orders", data),
  updateStatus: (id: number, status: string) => api.put<SalesOrder>(`/orders/${id}/status`, { status }),
};

// ---------- Invoices ----------
export const invoicesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Invoice>>("/invoices", { params }),
  get: (id: number) => api.get<Invoice>(`/invoices/${id}`),
};

// ---------- Payments ----------
export const paymentsApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Payment>>("/payments", { params }),
  create: (data: unknown) => api.post<Payment>("/payments", data),
};

export const supplierPaymentsApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<SupplierPayment>>("/supplier-payments", { params }),
  create: (data: unknown) => api.post<SupplierPayment>("/supplier-payments", data),
};

// ---------- Deliveries ----------
export const deliveriesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Delivery>>("/deliveries", { params }),
  create: (data: unknown) => api.post<Delivery>("/deliveries", data),
  update: (id: number, data: unknown) => api.put<Delivery>(`/deliveries/${id}`, data),
  updateStatus: (id: number, status: string, notes?: string) => api.put<Delivery>(`/deliveries/${id}/status`, { status, notes }),
};

// ---------- Employees ----------
export const employeesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Employee>>("/employees", { params }),
  create: (data: unknown) => api.post<Employee>("/employees", data),
  update: (id: number, data: unknown) => api.put<Employee>(`/employees/${id}`, data),
  deactivate: (id: number) => api.delete(`/employees/${id}`),
};

// ---------- Expenses ----------
export const expensesApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<Expense>>("/expenses", { params }),
  categories: () => api.get<ExpenseCategory[]>("/expenses/categories"),
  create: (data: unknown) => api.post<Expense>("/expenses", data),
};

// ---------- Dashboard ----------
export const dashboardApi = {
  get: () => api.get<DashboardData>("/dashboard"),
};

// ---------- Reports ----------
export const reportsApi = {
  dailySales: (params: Record<string, unknown>) => api.get("/reports/daily-sales", { params }),
  monthlySales: (params: Record<string, unknown>) => api.get("/reports/monthly-sales", { params }),
  salesByCustomer: (params: Record<string, unknown>) => api.get("/reports/sales-by-customer", { params }),
  salesByProduct: (params: Record<string, unknown>) => api.get("/reports/sales-by-product", { params }),
  purchases: (params: Record<string, unknown>) => api.get("/reports/purchases", { params }),
  receivables: () => api.get("/reports/receivables"),
  payables: () => api.get("/reports/payables"),
  inventory: () => api.get("/reports/inventory"),
  expenses: (params: Record<string, unknown>) => api.get("/reports/expenses", { params }),
  profitSummary: (params: Record<string, unknown>) => api.get("/reports/profit-summary", { params }),
  payments: (params: Record<string, unknown>) => api.get("/reports/payments", { params }),
  deliveries: (params: Record<string, unknown>) => api.get("/reports/deliveries", { params }),
  processing: (params: Record<string, unknown>) => api.get("/reports/processing", { params }),
  yield: (params: Record<string, unknown>) => api.get("/reports/yield", { params }),
  dailyStock: (params: Record<string, unknown>) => api.get("/reports/daily-stock", { params }),
  productProfit: (params: Record<string, unknown>) => api.get("/reports/product-profit", { params }),
  dailyProfit: (params: Record<string, unknown>) => api.get("/reports/daily-profit", { params }),
  cashVsCredit: (params: Record<string, unknown>) => api.get("/reports/cash-vs-credit", { params }),
};

// ---------- Audit Logs ----------
export const auditLogsApi = {
  list: (params: Record<string, unknown>) => api.get<PagedResult<AuditLog>>("/audit-logs", { params }),
};
