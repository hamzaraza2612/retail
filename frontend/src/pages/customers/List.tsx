import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { customersApi } from "../../api/endpoints";
import type { Customer, CustomerType } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const CUSTOMER_TYPES: CustomerType[] = ["Restaurant", "Hotel", "Caterer", "Shop", "Wholesale", "Individual", "Other"];

const emptyForm = {
  businessName: "", contactPerson: "", phone: "", whatsApp: "", address: "", city: "",
  customerType: "Restaurant" as CustomerType, creditLimit: 0, paymentTerms: "", openingBalance: 0, notes: "",
};

export default function CustomersList() {
  const [data, setData] = useState<{ items: Customer[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<Customer | null>(null);

  function load() {
    setLoading(true);
    customersApi
      .list({ search: search || undefined, page, pageSize })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      businessName: c.businessName, contactPerson: c.contactPerson ?? "", phone: c.phone,
      whatsApp: c.whatsApp ?? "", address: c.address ?? "", city: c.city ?? "", customerType: c.customerType,
      creditLimit: c.creditLimit, paymentTerms: c.paymentTerms ?? "", openingBalance: c.openingBalance, notes: c.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await customersApi.update(editing.id, { ...form, isActive: editing.isActive });
        toast.success("Customer updated");
      } else {
        await customersApi.create(form);
        toast.success("Customer created");
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
      await customersApi.deactivate(deactivating.id);
      toast.success("Customer deactivated");
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
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Restaurants, hotels, shops and wholesale accounts</p>
        </div>
        <Button onClick={openCreate}>+ New Customer</Button>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          placeholder="Search by name, phone or code…"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <Table
        keyFn={(c) => c.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Code", render: (c) => <Link to={`/customers/${c.id}`} className="text-green-700 font-medium">{c.customerCode}</Link> },
          { header: "Business Name", render: (c) => c.businessName },
          { header: "Type", render: (c) => c.customerType },
          { header: "Phone", render: (c) => c.phone },
          { header: "City", render: (c) => c.city ?? "-" },
          { header: "Balance", render: (c) => <span className={c.currentBalance > 0 ? "text-red-600 font-medium" : ""}>{formatMoney(c.currentBalance)}</span> },
          { header: "Status", render: (c) => (c.isActive ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>) },
          {
            header: "Actions",
            render: (c) => (
              <div className="flex gap-2">
                <button className="text-blue-600 text-xs" onClick={() => openEdit(c)}>Edit</button>
                {c.isActive && <button className="text-red-600 text-xs" onClick={() => setDeactivating(c)}>Deactivate</button>}
              </div>
            ),
          },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Customer" : "New Customer"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-4">
          <Input label="Business Name" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <Input label="Phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="WhatsApp" value={form.whatsApp} onChange={(e) => setForm({ ...form, whatsApp: e.target.value })} />
          <Select label="Customer Type" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value as CustomerType })}>
            {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="Address" className="col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Credit Limit (Rs.)" type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
          <Input label="Payment Terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. 15 Days" />
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
        title="Deactivate Customer"
        message={`Are you sure you want to deactivate ${deactivating?.businessName}? This will hide them from active lists but keep all history.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
