import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../api/types";

interface NavItem {
  to: string;
  label: string;
  roles?: UserRole[]; // undefined = all roles
}

// The business owner's day-to-day mental model: Purchase -> Cutting -> Stock -> Sale ->
// Payment -> Daily Result. These are the only items always pinned in the sidebar; every
// route, label and role restriction below is unchanged from the original flat nav (see
// BUSINESS_UX_AUDIT.md) — only how they're grouped and labeled has changed. "Settings"
// points at Products/pricing, the closest thing this app has to a settings screen.
const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Today" },
  { to: "/orders", label: "Sales", roles: ["Admin", "Manager", "Sales", "StoreKeeper"] },
  { to: "/purchases", label: "Purchase", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/processing", label: "Cutting", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/inventory", label: "Stock" },
  { to: "/customers", label: "Customers", roles: ["Admin", "Manager", "Sales", "Cashier"] },
  { to: "/payments", label: "Payments", roles: ["Admin", "Manager", "Cashier", "Sales"] },
  { to: "/expenses", label: "Expenses", roles: ["Admin", "Manager", "Cashier"] },
  { to: "/reports", label: "Reports", roles: ["Admin", "Manager"] },
  { to: "/products", label: "Settings" },
];

// Everything used for setup or occasional/admin work, tucked away but never removed —
// same routes, same role restrictions as the original nav.
const MORE_NAV: NavItem[] = [
  { to: "/inventory/history", label: "Stock Adjustments & History" },
  { to: "/suppliers", label: "Suppliers", roles: ["Admin", "Manager", "StoreKeeper"] },
  { to: "/invoices", label: "Invoices" },
  { to: "/supplier-payments", label: "Supplier Payments", roles: ["Admin", "Manager", "StoreKeeper", "Cashier"] },
  { to: "/deliveries", label: "Deliveries" },
  { to: "/employees", label: "Employees", roles: ["Admin", "Manager"] },
  { to: "/users", label: "Users", roles: ["Admin"] },
  { to: "/audit-logs", label: "Audit Logs", roles: ["Admin", "Manager"] },
];

function isItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const moreActive = MORE_NAV.some((item) => isItemActive(location.pathname, item.to));
  const [moreOpen, setMoreOpen] = useState(moreActive);

  // Keep the mobile drawer and the More/Administration group in sync with navigation that
  // didn't originate from a click in this sidebar (browser back/forward, a link elsewhere
  // in the app, a direct URL) — e.g. landing on /users should always reveal it, even if a
  // user had previously collapsed the group.
  useEffect(() => {
    setMobileOpen(false);
    if (moreActive) setMoreOpen(true);
  }, [location.pathname, moreActive]);

  const visiblePrimary = PRIMARY_NAV.filter((item) => !item.roles || hasRole(...item.roles));
  const visibleMore = MORE_NAV.filter((item) => !item.roles || hasRole(...item.roles));

  function linkClass({ isActive }: { isActive: boolean }) {
    return `block px-4 py-2 text-sm rounded-md mx-2 mb-0.5 ${
      isActive ? "bg-green-600 text-white font-semibold" : "text-gray-300 hover:bg-gray-800"
    }`;
  }

  const sidebarContent = (
    <>
      <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">Chicken Wholesale</h1>
          <p className="text-xs text-gray-400">Business Management</p>
        </div>
        <button
          type="button"
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {visiblePrimary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass} onClick={() => setMobileOpen(false)}>
            {item.label}
          </NavLink>
        ))}

        {visibleMore.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-2 mx-2 mb-0.5 text-xs font-semibold uppercase tracking-wide rounded-md ${
                moreActive ? "text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              style={{ width: "calc(100% - 1rem)" }}
              aria-expanded={moreOpen}
            >
              <span>More / Administration</span>
              <ChevronIcon open={moreOpen} />
            </button>
            {moreOpen && (
              <div>
                {visibleMore.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-gray-800 text-xs text-gray-400">
        <p className="text-gray-200 font-medium">{user?.fullName}</p>
        <p>{user?.role}</p>
        <button onClick={logout} className="mt-2 text-red-400 hover:text-red-300">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile top bar: hamburger + brand, only shown below md */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between bg-gray-900 text-white px-4 py-3">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="text-gray-200">
          <HamburgerIcon />
        </button>
        <span className="text-sm font-semibold">Chicken Wholesale</span>
        <span className="w-[22px]" />
      </div>

      {/* Backdrop for the mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={`bg-gray-900 text-gray-200 flex flex-col w-72 fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0 md:w-60 md:shrink-0`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
