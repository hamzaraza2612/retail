import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ordersApi, customersApi, productsApi } from "../../api/endpoints";
import type { SalesOrder, Customer, Product, SalesOrderStatus } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import { formatMoney, formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";
import Badge from "../../components/ui/Badge";

interface LineItem { productId: number; quantity: number; rate: number; }
const STATUSES: SalesOrderStatus[] = ["Draft", "Confirmed", "Processing", "Ready", "OutForDelivery", "Delivered", "Cancelled"];

export default function OrdersList() {
  const [data, setData] = useState<{ items: SalesOrder[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: 0, rate: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  function load() {
    setLoading(true);
    ordersApi.list({ status: status || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);
  useEffect(() => {
    customersApi.list({ active: true, pageSize: 200 }).then((res) => setCustomers(res.data.items));
    productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items));
  }, []);

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.rate, 0);
  const grandTotal = Math.max(0, subtotal - discount + deliveryCharges);

  function openCreate() {
    setCustomerId(customers[0]?.id ?? 0);
    setDeliveryDate("");
    setNotes("");
    setItems([{ productId: products[0]?.id ?? 0, quantity: 0, rate: products[0]?.salePrice ?? 0 }]);
    setDiscount(0);
    setDeliveryCharges(0);
    setPaidAmount(0);
    setModalOpen(true);
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { productId: products[0]?.id ?? 0, quantity: 0, rate: products[0]?.salePrice ?? 0 }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerId || items.some((it) => !it.productId || it.quantity <= 0)) {
      toast.error("Please select a customer and valid items");
      return;
    }
    setSaving(true);
    try {
      await ordersApi.create({
        customerId, deliveryDate: deliveryDate || undefined, items, discount, deliveryCharges, paidAmount, notes: notes || undefined,
      });
      toast.success("Order created as Draft");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-sm text-gray-500">Customer orders, from draft to delivery</p>
        </div>
        <Button onClick={openCreate}>+ New Order</Button>
      </div>

      <div className="mb-3">
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Table
        keyFn={(o) => o.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Order #", render: (o) => <Link to={`/orders/${o.id}`} className="text-green-700 font-medium">{o.orderNumber}</Link> },
          { header: "Date", render: (o) => formatDate(o.orderDate) },
          { header: "Customer", render: (o) => o.customerName },
          { header: "Total", render: (o) => formatMoney(o.grandTotal) },
          { header: "Remaining", render: (o) => <span className={o.remainingAmount > 0 ? "text-red-600" : ""}>{formatMoney(o.remainingAmount)}</span> },
          { header: "Status", render: (o) => <Badge value={o.status} /> },
          { header: "Payment", render: (o) => <Badge value={o.paymentStatus} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sales Order" wide>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4">
            <Select label="Customer" required value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </Select>
            <Input label="Delivery Date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>

          <p className="text-sm font-medium text-gray-700 mt-2 mb-1">Items</p>
          <div className="space-y-2">
            {items.map((it, i) => {
              const product = products.find((p) => p.id === it.productId);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select className="col-span-5 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={it.productId}
                    onChange={(e) => {
                      const p = products.find((pr) => pr.id === Number(e.target.value));
                      updateItem(i, { productId: Number(e.target.value), rate: p?.salePrice ?? 0 });
                    }}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit}) — stock {p.currentStock}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Qty" className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                  <input type="number" step="0.01" placeholder="Rate" className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={it.rate || ""} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} />
                  <span className="col-span-2 text-sm text-gray-600">{formatMoney(it.quantity * it.rate)}</span>
                  <button type="button" className="col-span-1 text-red-500 text-sm" onClick={() => removeItem(i)} disabled={items.length === 1}>&times;</button>
                  {product && product.currentStock < it.quantity && (
                    <span className="col-span-12 text-xs text-amber-600">Warning: requested quantity exceeds current stock ({product.currentStock} {product.unit})</span>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="text-sm text-green-700 mt-2" onClick={addItem}>+ Add item</button>

          <div className="grid grid-cols-2 gap-x-4 mt-3">
            <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div>
              <div className="flex justify-between text-sm py-1"><span>Subtotal</span><span className="font-medium">{formatMoney(subtotal)}</span></div>
              <Input label="Discount (Rs.)" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              <Input label="Delivery Charges (Rs.)" type="number" step="0.01" value={deliveryCharges} onChange={(e) => setDeliveryCharges(Number(e.target.value))} />
              <div className="flex justify-between text-sm py-1 font-semibold"><span>Grand Total</span><span>{formatMoney(grandTotal)}</span></div>
              <Input label="Paid Amount (Rs.)" type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-1">Order is created as Draft. Confirm it from the order detail page to deduct stock and generate the invoice.</p>
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Order"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
