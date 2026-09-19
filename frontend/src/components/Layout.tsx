import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../api/types";

interface NavItem {
  to: string;
  label: string;
  roles?: UserRole[]; // undefined = all roles
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/customers", label: "Customers", roles: ["Admin", "Manager", "Sales", "Cashier"] },
  { to: "/suppliers", label: "Suppliers", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/products", label: "Products" },
  { to: "/purchases", label: "Purchases", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/processing", label: "Processing / Cutting", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/inventory", label: "Inventory" },
  { to: "/orders", label: "Orders", roles: ["Admin", "Manager", "Sales", "StoreKeeper"] },
  { to: "/invoices", label: "Invoices" },
  { to: "/payments", label: "Payments", roles: ["Admin", "Manager", "Cashier", "Sales"] },
  { to: "/supplier-payments", label: "Supplier Payments", roles: ["Admin", "Manager", "StoreKeeper", "Cashier"] },
  { to: "/deliveries", label: "Deliveries" },
  { to: "/employees", label: "Employees", roles: ["Admin", "Manager"] },
  { to: "/expenses", label: "Expenses", roles: ["Admin", "Manager", "Cashier"] },
  { to: "/reports", label: "Reports", roles: ["Admin", "Manager"] },
  { to: "/users", label: "Users", roles: ["Admin"] },
  { to: "/audit-logs", label: "Audit Logs", roles: ["Admin", "Manager"] },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-60 bg-gray-900 text-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white leading-tight">Chicken Wholesale</h1>
          <p className="text-xs text-gray-400">Business Management</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm rounded-md mx-2 mb-0.5 ${
                  isActive ? "bg-green-600 text-white" : "text-gray-300 hover:bg-gray-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-400">
          <p className="text-gray-200 font-medium">{user?.fullName}</p>
          <p>{user?.role}</p>
          <button onClick={logout} className="mt-2 text-red-400 hover:text-red-300">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
