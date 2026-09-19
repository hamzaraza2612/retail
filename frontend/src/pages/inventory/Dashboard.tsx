import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { inventoryApi, productsApi } from "../../api/endpoints";
import type { InventoryDashboard, InventoryMovement, Product, InventoryMovementType } from "../../api/types";
import { StatCard, Card } from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import { formatMoney, formatDateTime } from "../../lib/format";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const ADJUSTMENT_TYPES: { value: InventoryMovementType; label: string }[] = [
  { value: "ADJUSTMENT_IN", label: "Adjustment In (found extra stock)" },
  { value: "ADJUSTMENT_OUT", label: "Adjustment Out (stock correction)" },
  { value: "WASTE", label: "Waste / Damaged" },
  { value: "RETURN_IN", label: "Return In (from customer)" },
  { value: "RETURN_OUT", label: "Return Out (to supplier)" },
];

export default function InventoryDashboardPage() {
  const { hasRole } = useAuth();
  const canAdjust = hasRole("Admin", "Manager", "StoreKeeper");
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState(0);
  const [movementType, setMovementType] = useState<InventoryMovementType>("ADJUSTMENT_OUT");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");

  function load() {
    inventoryApi.dashboard().then((res) => setDashboard(res.data));
    inventoryApi.movements({ pageSize: 30 }).then((res) => setMovements(res.data.items));
  }
  useEffect(load, []);
  useEffect(() => { productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items)); }, []);

  function openAdjust() {
    setProductId(products[0]?.id ?? 0);
    setMovementType("ADJUSTMENT_OUT");
    setQuantity(0);
    setReason("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId || quantity <= 0 || !reason) {
      toast.error("Please fill product, quantity and reason");
      return;
    }
    setSaving(true);
    try {
      await inventoryApi.adjust({ productId, quantity, movementType, reason });
      toast.success("Stock adjusted");
      setModalOpen(false);
      load();
      productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!dashboard) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">Stock levels and movement history</p>
        </div>
        {canAdjust && <Button onClick={openAdjust}>+ Adjust Stock</Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Products" value={dashboard.totalProducts} />
        <StatCard label="Low Stock Items" value={dashboard.lowStockCount} />
        <StatCard label="Stock Value" value={formatMoney(dashboard.totalStockValue)} sub="At purchase price" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Raw Material Stock</h3>
          <p className="text-xs text-gray-500 mb-2">{dashboard.rawMaterialCount} product(s) &middot; {formatMoney(dashboard.rawStockValue)} value</p>
          <div className="space-y-1.5">
            {products.filter((p) => p.productType === "RawMaterial").length === 0 && (
              <p className="text-sm text-gray-400">No raw material products yet.</p>
            )}
            {products.filter((p) => p.productType === "RawMaterial").map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5">
                <span className="text-gray-800">{p.name}</span>
                <span className={p.currentStock <= p.minimumStock ? "text-red-600 font-medium" : "font-medium"}>{p.currentStock} {p.unit}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Finished Product Stock</h3>
          <p className="text-xs text-gray-500 mb-2">{dashboard.finishedProductCount} product(s) &middot; {formatMoney(dashboard.finishedStockValue)} value</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {products.filter((p) => p.productType === "FinishedProduct").map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5">
                <span className="text-gray-800">{p.name}</span>
                <span className={p.currentStock <= p.minimumStock ? "text-red-600 font-medium" : "font-medium"}>{p.currentStock} {p.unit}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Low Stock Products</h3>
        <Table
          keyFn={(p) => p.id}
          rows={dashboard.lowStockProducts}
          emptyMessage="All stock levels are healthy."
          columns={[
            { header: "Product", render: (p) => p.name },
            { header: "Current Stock", render: (p) => <span className="text-red-600 font-medium">{p.currentStock} {p.unit}</span> },
            { header: "Minimum Stock", render: (p) => `${p.minimumStock} ${p.unit}` },
          ]}
        />
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Recent Stock Movements</h3>
        <Table
          keyFn={(m) => m.id}
          rows={movements}
          columns={[
            { header: "Date", render: (m) => formatDateTime(m.date) },
            { header: "Product", render: (m) => m.productName },
            { header: "Type", render: (m) => m.movementType },
            { header: "Quantity", render: (m) => `${m.quantity} ${m.unit}` },
            { header: "Stock After", render: (m) => m.stockAfter },
            { header: "Reference", render: (m) => m.referenceType ?? "-" },
            { header: "Notes", render: (m) => m.notes ?? "-" },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Adjust Stock">
        <form onSubmit={handleSubmit}>
          <Select label="Product" required value={productId} onChange={(e) => setProductId(Number(e.target.value))}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (current: {p.currentStock} {p.unit})</option>)}
          </Select>
          <Select label="Adjustment Type" value={movementType} onChange={(e) => setMovementType(e.target.value as InventoryMovementType)}>
            {ADJUSTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Quantity" type="number" step="0.01" required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <TextArea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged during transport" />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Adjustment"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
