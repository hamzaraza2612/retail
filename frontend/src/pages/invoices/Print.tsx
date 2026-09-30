import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { invoicesApi, ordersApi } from "../../api/endpoints";
import type { Invoice, SalesOrderStatus, OrderPaymentStatus } from "../../api/types";
import { formatMoney, formatDate } from "../../lib/format";

function isBlank(value?: string): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v === "" || v === "n/a" || v === "-";
}

const PAYMENT_STATUS_LABEL: Record<OrderPaymentStatus, string> = {
  Paid: "Paid in Full",
  Partial: "Partially Paid",
  Unpaid: "Unpaid",
};

// Every figure on this page is read straight from the Invoice the backend already computed
// (see InvoicesController.ToDto) — nothing here recalculates a total, a discount, or a
// balance. The only extra call is to the sales order this invoice bills, purely to learn
// whether it was later cancelled: a cancelled order's invoice is zeroed out rather than
// deleted (see SalesOrdersController's Cancelled branch), so without that context a
// cancelled invoice would otherwise print as a confusing, unexplained Rs. 0 receipt.
export default function InvoicePrintPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [orderStatus, setOrderStatus] = useState<SalesOrderStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    invoicesApi.get(Number(id)).then((res) => {
      setInvoice(res.data);
      ordersApi.get(res.data.salesOrderId).then((r) => setOrderStatus(r.data.status)).catch(() => {});
    });
  }, [id]);

  if (!invoice) return <p className="p-8 text-gray-400">Loading…</p>;

  const isCancelled = orderStatus === "Cancelled";

  return (
    <div className="bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">
      <div
        className="w-full max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-10 print:p-4 text-gray-900"
      >
        <div className="flex justify-between items-start border-b pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Chicken Wholesale & Supply</h1>
            <p className="text-sm text-gray-500">Wholesale Chicken Meat & Poultry Supply</p>
            <p className="text-sm text-gray-500">Lahore, Pakistan &middot; +92-300-0000000</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold uppercase text-gray-700">Invoice</h2>
            <p className="text-sm text-gray-500">{invoice.invoiceNumber}</p>
            <p className="text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</p>
          </div>
        </div>

        {isCancelled && (
          <div className="border-2 border-red-500 text-red-600 font-bold text-center rounded-md py-2 mb-6 uppercase tracking-wide">
            Cancelled — this order was cancelled; amounts below are void
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs uppercase text-gray-400 font-semibold">Customer</p>
            <p className="font-medium">{invoice.customerName}</p>
            {!isBlank(invoice.customerPhone) && <p className="text-sm text-gray-600">{invoice.customerPhone}</p>}
            {!isBlank(invoice.customerAddress) && <p className="text-sm text-gray-600">{invoice.customerAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-gray-400 font-semibold">Order Reference</p>
            <p className="text-sm">{invoice.orderNumber}</p>
          </div>
        </div>

        <table className="min-w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Quantity</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="py-2">{it.productName}</td>
                <td className="py-2 text-right">{it.quantity} {it.unit}</td>
                <td className="py-2 text-right">{formatMoney(it.rate)}</td>
                <td className="py-2 text-right">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(invoice.discount)}</span></div>
            {invoice.deliveryCharges > 0 && (
              <div className="flex justify-between"><span>Delivery Charges</span><span>{formatMoney(invoice.deliveryCharges)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Net Total</span><span>{formatMoney(invoice.grandTotal)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{formatMoney(invoice.paidAmount)}</span></div>
            <div className={`flex justify-between font-semibold ${invoice.balanceAmount > 0 ? "text-red-600" : "text-green-700"}`}>
              <span>Balance Due</span><span>{formatMoney(invoice.balanceAmount)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 border-t pt-3">
          Status: <span className="font-medium text-gray-600">{PAYMENT_STATUS_LABEL[invoice.paymentStatus]}</span> &middot; Thank you for your business.
        </p>

        <div className="mt-8 print:hidden">
          <button onClick={() => window.print()} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm">Print Invoice</button>
        </div>
      </div>
    </div>
  );
}
