import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { suppliersApi } from "../../api/endpoints";
import type { Supplier, SupplierType } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const SUPPLIER_TYPES: SupplierType[] = ["LiveChicken", "ChickenMeat", "RawMaterial", "Packaging", "Other"];

const emptyForm = {
  name: "", contactPerson: "", phone: "", whatsApp: "", address: "", city: "",
  supplierType: "LiveChicken" as SupplierType, openingBalance: 0, notes: "",
};

export default function SuppliersList() {
  const [data, setData] = useState<{ items: Supplier[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<Supplier | null>(null);

  function load() {
    setLoading(true);
    suppliersApi.list({ search: search || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [page, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name, contactPerson: s.contactPerson ?? "", phone: s.phone, whatsApp: s.whatsApp ?? "",
      address: s.address ?? "", city: s.city ?? "", supplierType: s.supplierType, openingBalance: s.openingBalance, notes: s.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await suppliersApi.update(editing.id, { ...form, isActive: editing.isActive });
        toast.success("Supplier updated");
      } else {
        await suppliersApi.create(form);
        toast.success("Supplier created");
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
      await suppliersApi.deactivate(deactivating.id);
      toast.success("Supplier deactivated");
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
          <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500">Live chicken, meat and raw material suppliers</p>
        </div>
        <Button onClick={openCreate}>+ New Supplier</Button>
      </div>

      <div className="mb-3">
        <input
          placeholder="Search by name, phone or code…"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Table
        keyFn={(s) => s.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Code", render: (s) => <Link to={`/suppliers/${s.id}`} className="text-green-700 font-medium">{s.supplierCode}</Link> },
          { header: "Name", render: (s) => s.name },
          { header: "Type", render: (s) => s.supplierType },
          { header: "Phone", render: (s) => s.phone },
          { header: "City", render: (s) => s.city ?? "-" },
          { header: "Payable", render: (s) => <span className={s.currentBalance > 0 ? "text-red-600 font-medium" : ""}>{formatMoney(s.currentBalance)}</span> },
          { header: "Status", render: (s) => (s.isActive ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>) },
          {
            header: "Actions",
            render: (s) => (
              <div className="flex gap-2">
                <button className="text-blue-600 text-xs" onClick={() => openEdit(s)}>Edit</button>
                {s.isActive && <button className="text-red-600 text-xs" onClick={() => setDeactivating(s)}>Deactivate</button>}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Supplier" : "New Supplier"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-4">
          <Input label="Supplier Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <Input label="Phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="WhatsApp" value={form.whatsApp} onChange={(e) => setForm({ ...form, whatsApp: e.target.value })} />
          <Select label="Supplier Type" value={form.supplierType} onChange={(e) => setForm({ ...form, supplierType: e.target.value as SupplierType })}>
            {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="Address" className="col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {!editing && <Input label="Opening Balance (Rs.)" type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} />}
          <TextArea label="Notes" className="col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate Supplier"
        message={`Are you sure you want to deactivate ${deactivating?.name}?`}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
