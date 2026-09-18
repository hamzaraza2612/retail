export type UserRole = "Admin" | "Manager" | "Sales" | "Cashier" | "StoreKeeper" | "Delivery";
export type UnitOfMeasure = "KG" | "Piece" | "Carton" | "Crate" | "Dozen" | "Custom";
export type CustomerType = "Restaurant" | "Hotel" | "Caterer" | "Shop" | "Wholesale" | "Individual" | "Other";
export type SupplierType = "LiveChicken" | "ChickenMeat" | "RawMaterial" | "Packaging" | "Other";
export type PurchaseStatus = "Confirmed" | "Cancelled";
export type InventoryMovementType = "PURCHASE" | "SALE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "WASTE" | "RETURN_IN" | "RETURN_OUT";
export type SalesOrderStatus = "Draft" | "Confirmed" | "Processing" | "Ready" | "OutForDelivery" | "Delivered" | "Cancelled";
export type OrderPaymentStatus = "Unpaid" | "Partial" | "Paid";
export type PaymentMethod = "Cash" | "BankTransfer" | "OnlineTransfer" | "Cheque" | "Other";
export type DeliveryStatus = "Pending" | "Assigned" | "OutForDelivery" | "Delivered" | "Failed" | "Cancelled";
export type EmployeeStatus = "Active" | "Inactive";

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  employeeId?: number;
  employeeName?: string;
}

export interface Customer {
  id: number;
  customerCode: string;
  businessName: string;
  contactPerson?: string;
  phone: string;
  whatsApp?: string;
  address?: string;
  city?: string;
  customerType: CustomerType;
  creditLimit: number;
  paymentTerms?: string;
  openingBalance: number;
  currentBalance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  totalPurchases: number;
  totalPaid: number;
  lastOrderDate?: string;
  totalOrders: number;
}

export interface Supplier {
  id: number;
  supplierCode: string;
  name: string;
  contactPerson?: string;
  phone: string;
  whatsApp?: string;
  address?: string;
  city?: string;
  supplierType: SupplierType;
  openingBalance: number;
  currentBalance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductCategory {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string;
  unit: UnitOfMeasure;
  purchasePrice: number;
  salePrice: number;
  minimumStock: number;
  currentStock: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unit: UnitOfMeasure;
  rate: number;
  total: number;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number;
  supplierName: string;
  purchaseDate: string;
  invoiceNumber?: string;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PurchaseStatus;
  notes?: string;
  createdAt: string;
  items: PurchaseItem[];
}

export interface InventoryMovement {
  id: number;
  productId: number;
  productName: string;
  movementType: InventoryMovementType;
  quantity: number;
  unit: UnitOfMeasure;
  referenceType?: string;
  referenceId?: number;
  stockAfter: number;
  date: string;
  notes?: string;
}

export interface InventoryDashboard {
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
  lowStockProducts: Product[];
}

export interface SalesOrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unit: UnitOfMeasure;
  rate: number;
  total: number;
}

export interface SalesOrder {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  status: SalesOrderStatus;
  paymentStatus: OrderPaymentStatus;
  notes?: string;
  createdAt: string;
  items: SalesOrderItem[];
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  salesOrderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  invoiceDate: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: OrderPaymentStatus;
  items: SalesOrderItem[];
}

export interface Payment {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface SupplierPayment {
  id: number;
  paymentNumber: string;
  supplierId: number;
  supplierName: string;
  purchaseId?: number;
  purchaseNumber?: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  phone: string;
  cnic?: string;
  role: string;
  department?: string;
  joiningDate: string;
  salary: number;
  status: EmployeeStatus;
  notes?: string;
}

export interface Delivery {
  id: number;
  salesOrderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  deliveryAddress?: string;
  driverEmployeeId?: number;
  driverName?: string;
  vehicle?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  status: DeliveryStatus;
  notes?: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface Expense {
  id: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  date: string;
  paidBy?: string;
  paymentMethod: PaymentMethod;
  description: string;
  receiptReference?: string;
  notes?: string;
  createdAt: string;
}

export interface DashboardCards {
  todaySales: number;
  todayOrders: number;
  todayPurchases: number;
  todayExpenses: number;
  totalReceivables: number;
  totalPayables: number;
  stockValue: number;
  estimatedGrossProfitThisMonth: number;
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface CategoryAmount {
  category: string;
  amount: number;
}

export interface TopProduct {
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface RecentOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  grandTotal: number;
  status: string;
  paymentStatus: string;
  orderDate: string;
}

export interface PendingDelivery {
  id: number;
  orderNumber: string;
  customerName: string;
  driverName?: string;
  status: string;
  deliveryDate?: string;
}

export interface LowStockItem {
  id: number;
  name: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
}

export interface RecentPayment {
  id: number;
  paymentNumber: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  method: string;
}

export interface DashboardData {
  cards: DashboardCards;
  salesLast7Days: DailyPoint[];
  ordersLast7Days: DailyPoint[];
  expensesByCategory: CategoryAmount[];
  topSellingProducts: TopProduct[];
  recentOrders: RecentOrder[];
  pendingDeliveries: PendingDelivery[];
  lowStockProducts: LowStockItem[];
  recentPayments: RecentPayment[];
}

export interface AuditLog {
  id: number;
  userId?: number;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  timestamp: string;
  description?: string;
}
