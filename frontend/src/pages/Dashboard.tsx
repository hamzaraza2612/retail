import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, productsApi } from "../api/endpoints";
import type { DashboardCards, Product } from "../api/types";
import { StatCard } from "../components/ui/Card";
import { formatMoney } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import NewSaleModal from "./orders/NewSaleModal";
import NewPurchaseModal from "./purchases/NewPurchaseModal";
import ChickenCuttingModal from "./processing/ChickenCuttingModal";
import ReceivePaymentModal from "./customers/ReceivePaymentModal";

const quickActionClass =
  "flex items-center justify-center text-center font-semibold text-sm rounded-lg px-3 py-4 bg-green-600 text-white hover:bg-green-700 transition-colors";

function QuickActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className={quickActionClass} onClick={onClick}>{children}</button>;
}

function QuickActionLink({ children, to }: { children: ReactNode; to: string }) {
  return <Link to={to} className={quickActionClass}>{children}</Link>;
}

// The business owner's "how is today going" screen: the ten numbers an owner actually
// checks first, and one-click shortcuts to the actions they take most. Every figure below
// comes straight from the existing /dashboard cards or the existing product list — nothing
// here recomputes a financial or stock figure the backend doesn't already produce. Detailed
// charts, top products, recent activity feeds etc. still live on their own pages (Reports,
// Orders, Deliveries, Payments, Stock) — this screen deliberately doesn't repeat them.
export default function Dashboard() {
  const { hasRole } = useAuth();
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);

  const [saleOpen, setSaleOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [cuttingOpen, setCuttingOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  function load() {
    dashboardApi.get().then((res) => setCards(res.data.cards));
    productsApi.list({ active: true, pageSize: 500 }).then((res) => setProducts(res.data.items));
  }
  useEffect(load, []);

  if (!cards || !products) return <p className="text-gray-400">Loading dashboard…</p>;

  const rawMaterials = products.filter((p) => p.productType === "RawMaterial");
  const finishedProducts = products.filter((p) => p.productType === "FinishedProduct");
  const rawStockTotal = rawMaterials.reduce((sum, p) => sum + p.currentStock, 0);
  const finishedStockTotal = finishedProducts.reduce((sum, p) => sum + p.currentStock, 0);
  const rawUnit = rawMaterials[0]?.unit ?? "KG";
  const finishedUnit = finishedProducts[0]?.unit ?? "KG";

  const canSell = hasRole("Admin", "Manager", "Sales");
  const canPurchase = hasRole("Admin", "Manager", "StoreKeeper");
  const canCut = hasRole("Admin", "Manager", "StoreKeeper");
  const canReceivePayment = hasRole("Admin", "Manager", "Cashier", "Sales");
  const canAddExpense = hasRole("Admin", "Manager", "Cashier");
  const canViewCustomers = hasRole("Admin", "Manager", "Sales", "Cashier");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Today's Business</h1>
        <p className="text-sm text-gray-500">How today looks so far</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {canSell && <QuickActionButton onClick={() => setSaleOpen(true)}>New Sale</QuickActionButton>}
        {canPurchase && <QuickActionButton onClick={() => setPurchaseOpen(true)}>New Purchase</QuickActionButton>}
        {canCut && <QuickActionButton onClick={() => setCuttingOpen(true)}>Cutting</QuickActionButton>}
        {canReceivePayment && <QuickActionButton onClick={() => setPaymentOpen(true)}>Receive Payment</QuickActionButton>}
        {canAddExpense && <QuickActionLink to="/expenses">Add Expense</QuickActionLink>}
        {canViewCustomers && <QuickActionLink to="/customers">Customer Ledger</QuickActionLink>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Today's Sales" value={formatMoney(cards.todaySales)} />
        <StatCard label="Cash Received" value={formatMoney(cards.todayCashSales)} sub="Walk-in / cash customer" />
        <StatCard label="Credit Sales" value={formatMoney(cards.todayCreditSales)} sub="Hotels, restaurants, etc." />
        <StatCard label="Customer Outstanding" value={formatMoney(cards.totalReceivables)} sub="Owed by customers" />
        <StatCard label="Today's Expenses" value={formatMoney(cards.todayExpenses)} />
        <StatCard label="Raw Chicken Stock" value={`${rawStockTotal} ${rawUnit}`} sub="On hand now" />
        <StatCard label="Finished Product Stock" value={`${finishedStockTotal} ${finishedUnit}`} sub="On hand now" />
        <StatCard label="Today's Processing" value={`${cards.todayProducedQuantity} KG`} sub={`${cards.todayProcessingBatches} cutting batch(es) completed`} />
        <StatCard label="Estimated Gross Profit" value={formatMoney(cards.todayEstimatedGrossProfit)} sub="Estimated — costing is weight-based" />
        <StatCard
          label="Estimated Operating Result"
          value={<span className={cards.todayOperatingProfitLoss < 0 ? "text-red-600" : ""}>{formatMoney(cards.todayOperatingProfitLoss)}</span>}
          sub="Estimated Profit after expenses"
        />
      </div>

      <NewSaleModal open={saleOpen} onClose={() => setSaleOpen(false)} onSaved={load} />
      <NewPurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} onSaved={load} />
      <ChickenCuttingModal open={cuttingOpen} onClose={() => setCuttingOpen(false)} onSaved={load} />
      <ReceivePaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} onSaved={load} />
    </div>
  );
}
