import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { suppliersApi } from "../../api/endpoints";
import type { Supplier } from "../../api/types";
import { Card, StatCard } from "../../components/ui/Card";
import { formatMoney, formatDate } from "../../lib/format";
import Badge from "../../components/ui/Badge";

interface StatementRow { type: string; date: string; reference: string; debit: number; credit: number; balance: number; }
interface PurchaseRow { id: number; purchaseNumber: string; purchaseDate: string; totalAmount: number; paidAmount: number; remainingAmount: number; status: string; }

export default function SupplierDetailPage() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [statement, setStatement] = useState<{ openingBalance: number; closingBalance: number; rows: StatementRow[] } | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);

  useEffect(() => {
    if (!id) return;
    suppliersApi.get(Number(id)).then((res) => setSupplier(res.data));
    suppliersApi.statement(Number(id)).then((res) => setStatement(res.data as typeof statement));
    suppliersApi.purchases(Number(id)).then((res) => setPurchases(res.data as PurchaseRow[]));
  }, [id]);

  if (!supplier) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/suppliers" className="text-sm text-gray-500 hover:underline">&larr; Back to Suppliers</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">{supplier.name}</h1>
        <p className="text-sm text-gray-500">{supplier.supplierCode} &middot; {supplier.supplierType} &middot; {supplier.phone}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Outstanding Payable" value={formatMoney(supplier.currentBalance)} />
        <StatCard label="Opening Balance" value={formatMoney(supplier.openingBalance)} />
        <StatCard label="Total Purchases" value={purchases.length} />
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Purchase History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="py-1.5 pr-4">Purchase #</th><th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Total</th>
              <th className="py-1.5 pr-4">Paid</th><th className="py-1.5 pr-4">Remaining</th><th className="py-1.5 pr-4">Status</th>
            </tr></thead>
            <tbody>
              {purchases.length === 0 && <tr><td colSpan={6} className="py-4 text-gray-400">No purchases yet.</td></tr>}
              {purchases.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 font-medium">{p.purchaseNumber}</td>
                  <td className="py-1.5 pr-4">{formatDate(p.purchaseDate)}</td>
                  <td className="py-1.5 pr-4">{formatMoney(p.totalAmount)}</td>
                  <td className="py-1.5 pr-4">{formatMoney(p.paidAmount)}</td>
                  <td className="py-1.5 pr-4">{formatMoney(p.remainingAmount)}</td>
                  <td className="py-1.5 pr-4"><Badge value={p.status} /></td>
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
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Type</th><th className="py-1.5 pr-4">Reference</th>
              <th className="py-1.5 pr-4">Debit</th><th className="py-1.5 pr-4">Credit</th><th className="py-1.5 pr-4">Balance</th>
            </tr></thead>
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
