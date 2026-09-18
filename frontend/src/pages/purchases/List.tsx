import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { purchasesApi, suppliersApi, productsApi } from "../../api/endpoints";
import type { Purchase, Supplier, Product } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import { formatMoney, formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";
import Badge from "../../components/ui/Badge";

interface LineItem { productId: number; quantity: number; rate: number; }

export default function PurchasesList() {
  const [data, setData] = useState<{ items: Purchase[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: 0, rate: 0 }]);
  const [paidAmount, setPaidAmount] = useState(0);

  function load() {
    setLoading(true);
    purchasesApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);
  useEffect(() => {
    suppliersApi.list({ active: true, pageSize: 200 }).then((res) => setSuppliers(res.data.items));
    productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items));
  }, []);

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.rate, 0);

  function openCreate() {
    setSupplierId(suppliers[0]?.id ?? 0);
    setInvoiceNumber("");
    setNotes("");
    setItems([{ productId: products[0]?.id ?? 0, quantity: 0, rate: products[0]?.purchasePrice ?? 0 }]);
    setPaidAmount(0);
    setModalOpen(true);
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: products[0]?.id ?? 0, quantity: 0, rate: products[0]?.purchasePrice ?? 0 }]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierId || items.some((it) => !it.productId || it.quantity <= 0)) {
      toast.error("Please select a supplier and valid items");
      return;
    }
    setSaving(true);
    try {
      await purchasesApi.create({ supplierId, invoiceNumber: invoiceNumber || undefined, items, paidAmount, notes: notes || undefined });
      toast.success("Purchase recorded and stock updated");
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
          <h1 className="text-xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500">Record incoming stock from suppliers</p>
        </div>
        <Button onClick={openCreate}>+ New Purchase</Button>
      </div>

      <Table
        keyFn={(p) => p.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Purchase #", render: (p) => p.purchaseNumber },
          { header: "Date", render: (p) => formatDate(p.purchaseDate) },
          { header: "Supplier", render: (p) => p.supplierName },
          { header: "Total", render: (p) => formatMoney(p.totalAmount) },
          { header: "Paid", render: (p) => formatMoney(p.paidAmount) },
          { header: "Remaining", render: (p) => <span className={p.remainingAmount > 0 ? "text-red-600" : ""}>{formatMoney(p.remainingAmount)}</span> },
          { header: "Status", render: (p) => <Badge value={p.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase" wide>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4">
            <Select label="Supplier" required value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Supplier Invoice #" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
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
                      updateItem(i, { productId: Number(e.target.value), rate: p?.purchasePrice ?? 0 });
                    }}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Qty" className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={it.quantity || ""} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                  <input type="number" step="0.01" placeholder="Rate" className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    value={it.rate || ""} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} />
                  <span className="col-span-2 text-sm text-gray-600">{formatMoney(it.quantity * it.rate)}</span>
                  <button type="button" className="col-span-1 text-red-500 text-sm" onClick={() => removeItem(i)} disabled={items.length === 1}>&times;</button>
                  {product && <span className="col-span-12 text-xs text-gray-400">Current stock: {product.currentStock} {product.unit}</span>}
                </div>
              );
            })}
          </div>
          <button type="button" className="text-sm text-green-700 mt-2" onClick={addItem}>+ Add item</button>

          <div className="grid grid-cols-2 gap-x-4 mt-3">
            <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div>
              <div className="flex justify-between text-sm py-1"><span>Subtotal</span><span className="font-medium">{formatMoney(subtotal)}</span></div>
              <Input label="Paid Amount (Rs.)" type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
              <div className="flex justify-between text-sm py-1"><span>Remaining Payable</span><span className="font-medium text-red-600">{formatMoney(subtotal - paidAmount)}</span></div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Purchase"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
