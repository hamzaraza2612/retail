import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CustomersList from "./pages/customers/List";
import CustomerDetailPage from "./pages/customers/Detail";
import SuppliersList from "./pages/suppliers/List";
import SupplierDetailPage from "./pages/suppliers/Detail";
import ProductsList from "./pages/products/List";
import PurchasesList from "./pages/purchases/List";
import ProcessingBatchesList from "./pages/processing/List";
import ProcessingBatchDetailPage from "./pages/processing/Detail";
import InventoryDashboardPage from "./pages/inventory/Dashboard";
import OrdersList from "./pages/orders/List";
import OrderDetailPage from "./pages/orders/Detail";
import InvoicesList from "./pages/invoices/List";
import InvoicePrintPage from "./pages/invoices/Print";
import PaymentsList from "./pages/payments/List";
import SupplierPaymentsList from "./pages/payments/SupplierPaymentsList";
import DeliveriesList from "./pages/deliveries/List";
import EmployeesList from "./pages/employees/List";
import ExpensesList from "./pages/expenses/List";
import ReportsPage from "./pages/reports/Reports";
import UsersList from "./pages/users/List";
import AuditLogsList from "./pages/audit/List";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrintPage /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/suppliers" element={<SuppliersList />} />
            <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
            <Route path="/products" element={<ProductsList />} />
            <Route path="/purchases" element={<PurchasesList />} />
            <Route path="/processing" element={<ProcessingBatchesList />} />
            <Route path="/processing/:id" element={<ProcessingBatchDetailPage />} />
            <Route path="/inventory" element={<InventoryDashboardPage />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/payments" element={<PaymentsList />} />
            <Route path="/supplier-payments" element={<SupplierPaymentsList />} />
            <Route path="/deliveries" element={<DeliveriesList />} />
            <Route path="/employees" element={<EmployeesList />} />
            <Route path="/expenses" element={<ExpensesList />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/audit-logs" element={<AuditLogsList />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
