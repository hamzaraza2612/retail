import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { productsApi } from "../../api/endpoints";
import type { Product, ProductCategory, ProductType, UnitOfMeasure } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

const UNITS: UnitOfMeasure[] = ["KG", "Piece", "Carton", "Crate", "Dozen", "Custom"];

const emptyForm = {
  sku: "", name: "", categoryId: 0, unit: "KG" as UnitOfMeasure, purchasePrice: 0, salePrice: 0,
  minimumStock: 0, description: "", productType: "FinishedProduct" as ProductType,
};

export default function ProductsList() {
  const { hasRole } = useAuth();
  const canManage = hasRole("Admin", "Manager", "StoreKeeper");
  const [data, setData] = useState<{ items: Product[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ProductType | "">("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<Product | null>(null);

  function load() {
    setLoading(true);
    productsApi.list({ search: search || undefined, lowStock: lowStockOnly || undefined, productType: typeFilter || undefined, page, pageSize })
      .then((res) => setData(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [page, search, lowStockOnly, typeFilter]);
  useEffect(() => { productsApi.categories().then((res) => setCategories(res.data)); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? 0 });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku, name: p.name, categoryId: p.categoryId, unit: p.unit, purchasePrice: p.purchasePrice,
      salePrice: p.salePrice, minimumStock: p.minimumStock, description: p.description ?? "", productType: p.productType,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await productsApi.update(editing.id, { ...form, isActive: editing.isActive });
        toast.success("Product updated");
      } else {
        await productsApi.create(form);
        toast.success("Product created");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    try {
      await productsApi.deactivate(deactivating.id);
      toast.success("Product deactivated");
      setDeactivating(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Chicken product catalog and pricing</p>
        </div>
        {canManage && <Button onClick={openCreate}>+ New Product</Button>}
      </div>

      <div className="mb-3 flex items-center gap-3">
        <input
          placeholder="Search by name or SKU…"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }} />
          Low stock only
        </label>
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as ProductType | ""); setPage(1); }}>
          <option value="">All Types</option>
          <option value="RawMaterial">Raw Material</option>
          <option value="FinishedProduct">Finished Product</option>
        </select>
      </div>

      <Table
        keyFn={(p) => p.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "SKU", render: (p) => p.sku },
          { header: "Name", render: (p) => p.name },
          { header: "Category", render: (p) => p.categoryName },
          { header: "Type", render: (p) => <span className={p.productType === "RawMaterial" ? "text-amber-700 text-xs font-medium" : "text-gray-500 text-xs"}>{p.productType === "RawMaterial" ? "Raw Material" : "Finished"}</span> },
          { header: "Unit", render: (p) => p.unit },
          { header: "Purchase Price", render: (p) => formatMoney(p.purchasePrice) },
          { header: "Sale Price", render: (p) => formatMoney(p.salePrice) },
          { header: "Stock", render: (p) => <span className={p.currentStock <= p.minimumStock ? "text-red-600 font-medium" : ""}>{p.currentStock}</span> },
          { header: "Status", render: (p) => (p.isActive ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>) },
          ...(canManage ? [{
            header: "Actions",
            render: (p: Product) => (
              <div className="flex gap-2">
                <button className="text-blue-600 text-xs" onClick={() => openEdit(p)}>Edit</button>
                {p.isActive && <button className="text-red-600 text-xs" onClick={() => setDeactivating(p)}>Deactivate</button>}
              </div>
            ),
          }] : []),
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "New Product"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-4">
          <Input label="SKU" required disabled={!!editing} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Category" required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as UnitOfMeasure })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Select label="Type" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value as ProductType })}>
            <option value="FinishedProduct">Finished Product (sellable)</option>
            <option value="RawMaterial">Raw Material (processing input)</option>
          </Select>
          <Input label="Purchase Price (Rs.)" type="number" step="0.01" required value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
          <Input label="Sale Price (Rs.)" type="number" step="0.01" required value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} />
          <Input label="Minimum Stock" type="number" step="0.01" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })} />
          <TextArea label="Description" className="col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate Product"
        message={`Are you sure you want to deactivate ${deactivating?.name}?`}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
