import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { customersApi } from "../../api/endpoints";
import type { CustomerDetail } from "../../api/types";
import { Card, StatCard } from "../../components/ui/Card";
import { formatMoney, formatDate } from "../../lib/format";
import Badge from "../../components/ui/Badge";

interface StatementRow { type: string; date: string; reference: string; debit: number; credit: number; balance: number; }
interface OrderRow { id: number; orderNumber: string; orderDate: string; status: string; paymentStatus: string; grandTotal: number; paidAmount: number; remainingAmount: number; }

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [statement, setStatement] = useState<{ openingBalance: number; closingBalance: number; rows: StatementRow[] } | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!id) return;
    customersApi.get(Number(id)).then((res) => setDetail(res.data));
    customersApi.statement(Number(id)).then((res) => setStatement(res.data as typeof statement));
    customersApi.orders(Number(id)).then((res) => setOrders(res.data as OrderRow[]));
  }, [id]);

  if (!detail) return <p className="text-gray-400">Loading…</p>;
  const { customer } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/customers" className="text-sm text-gray-500 hover:underline">&larr; Back to Customers</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{customer.businessName}</h1>
          <p className="text-sm text-gray-500">{customer.customerCode} &middot; {customer.customerType} &middot; {customer.phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Outstanding Balance" value={formatMoney(customer.currentBalance)} />
        <StatCard label="Total Purchases" value={formatMoney(detail.totalPurchases)} />
        <StatCard label="Total Paid" value={formatMoney(detail.totalPaid)} />
        <StatCard label="Last Order" value={detail.lastOrderDate ? formatDate(detail.lastOrderDate) : "-"} sub={`${detail.totalOrders} orders total`} />
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Order History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1.5 pr-4">Order #</th><th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Status</th>
                <th className="py-1.5 pr-4">Payment</th><th className="py-1.5 pr-4">Total</th><th className="py-1.5 pr-4">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={6} className="py-4 text-gray-400">No orders yet.</td></tr>}
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-4"><Link to={`/orders/${o.id}`} className="text-green-700 font-medium">{o.orderNumber}</Link></td>
                  <td className="py-1.5 pr-4">{formatDate(o.orderDate)}</td>
                  <td className="py-1.5 pr-4"><Badge value={o.status} /></td>
                  <td className="py-1.5 pr-4"><Badge value={o.paymentStatus} /></td>
                  <td className="py-1.5 pr-4">{formatMoney(o.grandTotal)}</td>
                  <td className="py-1.5 pr-4">{formatMoney(o.remainingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Account Statement</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Type</th><th className="py-1.5 pr-4">Reference</th>
                <th className="py-1.5 pr-4">Debit</th><th className="py-1.5 pr-4">Credit</th><th className="py-1.5 pr-4">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-gray-50">
                <td className="py-1.5 pr-4" colSpan={5}>Opening Balance</td>
                <td className="py-1.5 pr-4 font-medium">{formatMoney(statement?.openingBalance)}</td>
              </tr>
              {statement?.rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">{formatDate(r.date)}</td>
                  <td className="py-1.5 pr-4">{r.type}</td>
                  <td className="py-1.5 pr-4">{r.reference}</td>
                  <td className="py-1.5 pr-4">{r.debit ? formatMoney(r.debit) : "-"}</td>
                  <td className="py-1.5 pr-4">{r.credit ? formatMoney(r.credit) : "-"}</td>
                  <td className="py-1.5 pr-4 font-medium">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
