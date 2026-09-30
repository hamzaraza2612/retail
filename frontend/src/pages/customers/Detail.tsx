import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { customersApi } from "../../api/endpoints";
import type { CustomerDetail } from "../../api/types";
import { Card, StatCard } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { formatMoney, formatDate } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import NewSaleModal from "../orders/NewSaleModal";
import ReceivePaymentModal from "./ReceivePaymentModal";

interface StatementRow { type: string; date: string; reference: string; debit: number; credit: number; balance: number; }
interface Statement { openingBalance: number; closingBalance: number; rows: StatementRow[]; }

const RECENT_COUNT = 5;

// The statement is this customer's authoritative ledger, generated entirely server-side
// (see CustomersController.GetStatement) — every figure below is either used exactly as
// returned (openingBalance, closingBalance / Current Due) or is a plain sum of amounts the
// backend already reported, never a new calculation of what's actually owed.
function describeRow(row: StatementRow): { label: string; amount: number; isCredit: boolean } {
  const isSale = row.type === "Invoice";
  return { label: isSale ? "Sale" : "Payment", amount: isSale ? row.debit : row.credit, isCredit: !isSale };
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const canSell = hasRole("Admin", "Manager", "Sales");
  const canReceivePayment = hasRole("Admin", "Manager", "Cashier", "Sales");

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [showFullLedger, setShowFullLedger] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  function load() {
    if (!id) return;
    customersApi.get(Number(id)).then((res) => setDetail(res.data));
    customersApi.statement(Number(id)).then((res) => setStatement(res.data as Statement));
  }
  useEffect(load, [id]);

  if (!detail) return <p className="text-gray-400">Loading…</p>;
  const { customer } = detail;

  const rowsDescending = statement ? [...statement.rows].reverse() : [];
  const visibleRows = showFullLedger ? rowsDescending : rowsDescending.slice(0, RECENT_COUNT);
  const creditSalesTotal = statement ? statement.rows.filter((r) => r.type === "Invoice").reduce((sum, r) => sum + r.debit, 0) : 0;
  const paymentsReceivedTotal = statement ? statement.rows.filter((r) => r.type === "Payment").reduce((sum, r) => sum + r.credit, 0) : 0;

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
        <StatCard label="Total Sales" value={formatMoney(detail.totalPurchases)} />
        <StatCard label="Total Paid" value={formatMoney(detail.totalPaid)} />
        <StatCard label="Outstanding" value={<span className={customer.currentBalance > 0 ? "text-red-600" : ""}>{formatMoney(customer.currentBalance)}</span>} />
        <StatCard label="Last Sale" value={detail.lastOrderDate ? formatDate(detail.lastOrderDate) : "-"} sub={`${detail.totalOrders} sale${detail.totalOrders === 1 ? "" : "s"} total`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {canSell && <Button onClick={() => setSaleOpen(true)}>New Sale</Button>}
        {canReceivePayment && <Button variant="secondary" onClick={() => setPaymentOpen(true)}>Receive Payment</Button>}
        <Button variant="secondary" onClick={() => setShowFullLedger((v) => !v)}>View Ledger</Button>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Ledger Summary</h3>
        <div className="space-y-1.5 text-sm max-w-xs">
          <div className="flex justify-between"><span className="text-gray-600">Opening Due</span><span className="font-medium">{formatMoney(statement?.openingBalance)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">+ Credit Sales</span><span className="font-medium">{formatMoney(creditSalesTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">&minus; Payments Received</span><span className="font-medium text-green-700">{formatMoney(paymentsReceivedTotal)}</span></div>
          <div className="flex justify-between font-semibold text-base border-t pt-1.5">
            <span>Current Due</span>
            <span className={(statement?.closingBalance ?? 0) > 0 ? "text-red-600" : ""}>{formatMoney(statement?.closingBalance)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">{showFullLedger ? "Full Ledger" : "Recent Transactions"}</h3>
        <div className="space-y-2">
          {visibleRows.length === 0 && <p className="text-sm text-gray-400">No transactions yet.</p>}
          {visibleRows.map((r, i) => {
            const { label, amount, isCredit } = describeRow(r);
            return (
              <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium text-gray-800">{label}</p>
                  <p className="text-gray-400 text-xs">{formatDate(r.date)} &middot; {r.reference}</p>
                </div>
                <span className={`font-medium ${isCredit ? "text-green-700" : "text-gray-900"}`}>
                  {isCredit ? "− " : ""}{formatMoney(amount)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {canSell && (
        <NewSaleModal
          open={saleOpen}
          onClose={() => setSaleOpen(false)}
          onSaved={load}
          initialMode="CREDIT"
          presetCustomerId={customer.id}
        />
      )}
      {canReceivePayment && (
        <ReceivePaymentModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          onSaved={load}
          customerId={customer.id}
          customerName={customer.businessName}
          currentBalance={customer.currentBalance}
        />
      )}
    </div>
  );
}
