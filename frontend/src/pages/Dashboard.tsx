import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardApi } from "../api/endpoints";
import type { DashboardData } from "../api/types";
import { StatCard, Card } from "../components/ui/Card";
import { formatMoney, formatDate, formatDateTime } from "../lib/format";
import Badge from "../components/ui/Badge";

const COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">Loading dashboard…</p>;
  if (!data) return <p className="text-red-500">Failed to load dashboard.</p>;

  const { cards } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of today's business activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Sales" value={formatMoney(cards.todaySales)} />
        <StatCard label="Today's Orders" value={cards.todayOrders} />
        <StatCard label="Today's Purchases" value={formatMoney(cards.todayPurchases)} />
        <StatCard label="Today's Expenses" value={formatMoney(cards.todayExpenses)} />
        <StatCard label="Receivables" value={formatMoney(cards.totalReceivables)} sub="Outstanding from customers" />
        <StatCard label="Payables" value={formatMoney(cards.totalPayables)} sub="Outstanding to suppliers" />
        <StatCard label="Stock Value" value={formatMoney(cards.stockValue)} sub="At purchase price" />
        <StatCard label="Est. Gross Profit" value={formatMoney(cards.estimatedGrossProfitThisMonth)} sub="This month (estimate)" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Today's Processing &amp; Profit/Loss</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Cash Sales" value={formatMoney(cards.todayCashSales)} sub="Walk-in / cash customer" />
          <StatCard label="Credit Sales" value={formatMoney(cards.todayCreditSales)} sub="Hotels, restaurants, etc." />
          <StatCard label="Est. Gross Profit (Today)" value={formatMoney(cards.todayEstimatedGrossProfit)} sub="Sales - estimated COGS" />
          <StatCard
            label="Operating Profit/Loss"
            value={<span className={cards.todayOperatingProfitLoss < 0 ? "text-red-600" : ""}>{formatMoney(cards.todayOperatingProfitLoss)}</span>}
            sub="Gross profit - expenses"
          />
          <StatCard label="Processing Batches" value={cards.todayProcessingBatches} sub="Completed today" />
          <StatCard label="Raw Material Processed" value={`${cards.todayRawMaterialProcessed} KG`} sub="Today" />
          <StatCard label="Produced Quantity" value={`${cards.todayProducedQuantity} KG`} sub="Finished output today" />
          <StatCard label="Raw / Finished Stock" value={`${formatMoney(cards.rawStockValue)} / ${formatMoney(cards.finishedStockValue)}`} sub="Stock value by type" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3">Sales — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.salesLast7Days}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => formatDate(d)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} labelFormatter={(d) => formatDate(String(d))} />
              <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Expenses by Category</h3>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.expensesByCategory} dataKey="amount" nameKey="category" outerRadius={80} label={(e) => String(e.name ?? "")}>
                  {data.expensesByCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3">Orders — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.ordersLast7Days}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => formatDate(d)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(d) => formatDate(String(d))} />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Top Selling Products</h3>
          <ul className="space-y-2">
            {data.topSellingProducts.length === 0 && <p className="text-sm text-gray-400">No sales yet.</p>}
            {data.topSellingProducts.map((p) => (
              <li key={p.productName} className="flex justify-between text-sm">
                <span className="text-gray-700">{p.productName}</span>
                <span className="font-medium text-gray-900">{formatMoney(p.revenue)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Recent Orders</h3>
          <div className="space-y-2">
            {data.recentOrders.length === 0 && <p className="text-sm text-gray-400">No orders yet.</p>}
            {data.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium text-gray-800">{o.orderNumber}</p>
                  <p className="text-gray-500 text-xs">{o.customerName} &middot; {formatDate(o.orderDate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatMoney(o.grandTotal)}</p>
                  <Badge value={o.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Pending Deliveries</h3>
          <div className="space-y-2">
            {data.pendingDeliveries.length === 0 && <p className="text-sm text-gray-400">No pending deliveries.</p>}
            {data.pendingDeliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium text-gray-800">{d.orderNumber}</p>
                  <p className="text-gray-500 text-xs">{d.customerName} {d.driverName ? `· ${d.driverName}` : ""}</p>
                </div>
                <Badge value={d.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Low Stock Alerts</h3>
          <div className="space-y-2">
            {data.lowStockProducts.length === 0 && <p className="text-sm text-gray-400">All stock levels healthy.</p>}
            {data.lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <span className="text-gray-800">{p.name}</span>
                <span className="text-red-600 font-medium">{p.currentStock} / {p.minimumStock} {p.unit}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {data.recentPayments.length === 0 && <p className="text-sm text-gray-400">No payments yet.</p>}
            {data.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="text-gray-800">{p.customerName}</p>
                  <p className="text-gray-400 text-xs">{formatDateTime(p.paymentDate)} &middot; {p.method}</p>
                </div>
                <span className="font-medium text-green-700">{formatMoney(p.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
