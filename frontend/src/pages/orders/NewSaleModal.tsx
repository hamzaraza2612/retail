import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ordersApi, customersApi, productsApi, invoicesApi } from "../../api/endpoints";
import type { Customer, Product } from "../../api/types";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

// The standing "Walk-in / Cash Customer" record is how the rest of the app (reporting,
// dashboard cash-vs-credit split) already distinguishes a cash sale from a credit sale —
// see BUSINESS_WORKFLOW.md. Reusing that same identifier here, not inventing a new one.
const CASH_CUSTOMER_CODE = "CASH-001";

type SaleMode = "CASH" | "CREDIT";

interface LineItem {
  productId: number;
  quantity: number;
  rate: number;
}

interface SavedSale {
  orderId: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
  customerId: number;
  customerName: string;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
}

function emptyLine(defaultProductId: number, defaultRate: number): LineItem {
  return { productId: defaultProductId, quantity: 0, rate: defaultRate };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function NewSaleModal({ open, onClose, onSaved }: Props) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [mode, setMode] = useState<SaleMode>("CASH");
  const [customerId, setCustomerId] = useState(0);
  const [items, setItems] = useState<LineItem[]>([emptyLine(0, 0)]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedSale | null>(null);

  useEffect(() => {
    if (!open) return;
    customersApi.list({ active: true, pageSize: 200 }).then((res) => setCustomers(res.data.items));
    productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items));
  }, [open]);

  const cashCustomer = customers.find((c) => c.customerCode === CASH_CUSTOMER_CODE);
  const creditCustomers = customers.filter((c) => c.customerCode !== CASH_CUSTOMER_CODE);
  const effectiveCustomerId = mode === "CASH" ? cashCustomer?.id ?? 0 : customerId;

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.rate, 0);
  const netTotal = Math.max(0, subtotal - discount);
  const balance = Math.max(0, netTotal - paidAmount);

  // Cash Received defaults to (and keeps following) the Net Total for a cash sale until the
  // user deliberately types their own amount — the common case is "paid in full on the spot."
  useEffect(() => {
    if (mode === "CASH" && !paidTouched) setPaidAmount(netTotal);
  }, [mode, netTotal, paidTouched]);

  function resetForm() {
    setMode("CASH");
    setCustomerId(0);
    setItems([emptyLine(0, 0)]);
    setDiscount(0);
    setPaidAmount(0);
    setPaidTouched(false);
    setSaved(null);
  }

  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Products load asynchronously and may not be ready yet the moment the modal opens —
  // once they arrive, fill in the still-untouched default row rather than leaving it
  // pointing at product id 0 (which would otherwise silently mismatch the dropdown's own
  // first-option display until the user manually reselects a product).
  useEffect(() => {
    if (products.length === 0) return;
    setItems((prev) =>
      prev.length === 1 && prev[0].productId === 0 && prev[0].quantity === 0
        ? [emptyLine(products[0].id, products[0].salePrice)]
        : prev
    );
  }, [products]);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, emptyLine(products[0]?.id ?? 0, products[0]?.salePrice ?? 0)]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return; // belt-and-braces against a double-click racing the state update below

    if (!effectiveCustomerId) {
      toast.error(mode === "CASH" ? "Walk-in / Cash Customer not found — contact your administrator." : "Please select a customer.");
      return;
    }
    if (items.length === 0 || items.some((it) => !it.productId || it.quantity <= 0)) {
      toast.error("Please add at least one product with a valid quantity.");
      return;
    }

    setSaving(true);
    let orderId: number | null = null;
    try {
      const createRes = await ordersApi.create({
        customerId: effectiveCustomerId,
        items: items.map((it) => ({ productId: it.productId, quantity: it.quantity, rate: it.rate })),
        discount,
        deliveryCharges: 0,
        paidAmount,
      });
      orderId = createRes.data.id;

      // The backend still models a sale as Draft -> Confirmed (Confirm is what deducts
      // stock and generates the invoice — see BUSINESS_WORKFLOW.md). That two-step lifecycle
      // is unchanged; this single "Save Sale" action just drives both steps back-to-back so
      // the person doesn't have to.
      const confirmRes = await ordersApi.updateStatus(orderId, "Confirmed");
      const confirmedOrder = confirmRes.data;

      let invoiceId: number | null = null;
      let invoiceNumber: string | null = null;
      try {
        const invRes = await invoicesApi.list({ customerId: confirmedOrder.customerId, pageSize: 100 });
        const match = invRes.data.items.find((inv) => inv.orderNumber === confirmedOrder.orderNumber);
        if (match) {
          invoiceId = match.id;
          invoiceNumber = match.invoiceNumber;
        }
      } catch {
        // The sale itself is already saved at this point; a failure to look up the invoice
        // number for display is not a reason to tell the user the sale failed.
      }

      setSaved({
        orderId: confirmedOrder.id,
        invoiceId,
        invoiceNumber,
        customerId: confirmedOrder.customerId,
        customerName: confirmedOrder.customerName,
        grandTotal: confirmedOrder.grandTotal,
        paidAmount: confirmedOrder.paidAmount,
        remainingAmount: confirmedOrder.remainingAmount,
      });
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
      // Nothing was actually sold — a Draft with no stock/ledger impact was created but
      // never confirmed (e.g. insufficient stock). Clean it up rather than leaving it
      // behind for the user to find and cancel manually.
      if (orderId) {
        ordersApi.updateStatus(orderId, "Cancelled").catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={saved ? "Sale Saved" : "New Sale"} wide>
      {saved ? (
        <div>
          <p className="text-green-700 font-semibold text-lg mb-4">Sale Saved</p>
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div><p className="text-xs text-gray-500">Invoice Number</p><p className="font-semibold">{saved.invoiceNumber ?? "-"}</p></div>
            <div><p className="text-xs text-gray-500">Customer</p><p className="font-semibold">{saved.customerName}</p></div>
            <div><p className="text-xs text-gray-500">Total</p><p className="font-semibold">{formatMoney(saved.grandTotal)}</p></div>
            <div><p className="text-xs text-gray-500">Paid</p><p className="font-semibold">{formatMoney(saved.paidAmount)}</p></div>
            <div><p className="text-xs text-gray-500">Remaining</p><p className={`font-semibold ${saved.remainingAmount > 0 ? "text-red-600" : ""}`}>{formatMoney(saved.remainingAmount)}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {saved.invoiceId != null && (
              <Button variant="secondary" onClick={() => window.open(`/invoices/${saved.invoiceId}/print`, "_blank")}>Print Invoice</Button>
            )}
            <Button variant="secondary" onClick={() => { navigate(`/customers/${saved.customerId}`); onClose(); }}>View Customer</Button>
            <Button onClick={resetForm}>New Sale</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode("CASH")}
              className={`rounded-md border py-2.5 text-sm font-semibold ${mode === "CASH" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
            >
              CASH SALE
            </button>
            <button
              type="button"
              onClick={() => setMode("CREDIT")}
              className={`rounded-md border py-2.5 text-sm font-semibold ${mode === "CREDIT" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
            >
              CREDIT SALE
            </button>
          </div>

          {mode === "CASH" ? (
            <p className="text-sm text-gray-600 mb-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              Customer: <span className="font-medium text-gray-800">{cashCustomer?.businessName ?? "Walk-in / Cash Customer (not found)"}</span>
            </p>
          ) : (
            <Select label="Customer" aria-label="Customer" required value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))} className="mb-3">
              <option value={0}>Select customer…</option>
              {creditCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.businessName}{c.currentBalance > 0 ? ` (owes ${formatMoney(c.currentBalance)})` : ""}</option>
              ))}
            </Select>
          )}

          <p className="text-sm font-medium text-gray-700 mb-1">Products</p>
          <div className="space-y-2">
            {items.map((it, i) => {
              const product = products.find((p) => p.id === it.productId);
              const overridden = !!product && it.rate !== product.salePrice;
              return (
                <div key={i}>
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select
                      aria-label="Product"
                      className="col-span-5 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      value={it.productId}
                      onChange={(e) => {
                        const p = products.find((pr) => pr.id === Number(e.target.value));
                        updateItem(i, { productId: Number(e.target.value), rate: p?.salePrice ?? 0 });
                      }}
                    >
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit}) — stock {p.currentStock}</option>)}
                    </select>
                    <input
                      aria-label="Quantity"
                      type="number" step="0.01" placeholder={`Qty ${product?.unit ?? ""}`}
                      className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    />
                    <input
                      aria-label="Rate"
                      type="number" step="0.01" placeholder="Rate"
                      className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      value={it.rate || ""} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })}
                    />
                    <span className="col-span-2 text-sm text-gray-700 font-medium">{formatMoney(it.quantity * it.rate)}</span>
                    <button type="button" aria-label="Remove product" className="col-span-1 text-red-500 text-sm" onClick={() => removeItem(i)} disabled={items.length === 1}>&times;</button>
                  </div>
                  {product && product.currentStock < it.quantity && (
                    <p className="text-xs text-amber-600 mt-0.5">Only {product.currentStock} {product.unit} in stock — this will be rejected if it exceeds what's on hand when saved.</p>
                  )}
                  {overridden && (
                    <p className="text-xs text-gray-400 mt-0.5">Overriding catalog price of {formatMoney(product!.salePrice)} for this sale only.</p>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="text-sm text-green-700 mt-2" onClick={addItem}>+ Add product</button>

          <div className="mt-4 border-t pt-3 space-y-1 text-sm max-w-sm ml-auto">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Discount (Rs.)</span>
              <input type="number" step="0.01" className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm text-right" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Net Total</span><span>{formatMoney(netTotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{mode === "CASH" ? "Cash Received" : "Paid Now (Rs.)"}</span>
              <input
                type="number" step="0.01" className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm text-right"
                value={paidAmount || ""}
                onChange={(e) => { setPaidTouched(true); setPaidAmount(Number(e.target.value)); }}
              />
            </div>
            <div className={`flex justify-between font-semibold border-t pt-1 ${balance > 0 ? "text-red-600" : "text-green-700"}`}>
              <span>{mode === "CREDIT" ? "Amount Due" : "Balance"}</span><span>{formatMoney(balance)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "SAVE SALE"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
