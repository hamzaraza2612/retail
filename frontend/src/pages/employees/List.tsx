import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { employeesApi } from "../../api/endpoints";
import type { Employee } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, TextArea } from "../../components/ui/Input";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatMoney, formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";

const emptyForm = { name: "", phone: "", cnic: "", role: "", department: "", joiningDate: "", salary: 0, notes: "" };
const ROLES = ["Manager", "Sales", "Cashier", "Store Keeper", "Driver", "Delivery Staff", "Worker", "Processing Staff"];

export default function EmployeesList() {
  const [data, setData] = useState<{ items: Employee[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);

  function load() {
    setLoading(true);
    employeesApi.list({ search: search || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({ name: e.name, phone: e.phone, cnic: e.cnic ?? "", role: e.role, department: e.department ?? "", joiningDate: e.joiningDate.slice(0, 10), salary: e.salary, notes: e.notes ?? "" });
    setModalOpen(true);
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await employeesApi.update(editing.id, { ...form, status: editing.status });
        toast.success("Employee updated");
      } else {
        await employeesApi.create(form);
        toast.success("Employee added");
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
      await employeesApi.deactivate(deactivating.id);
      toast.success("Employee deactivated");
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
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">Workers, drivers and staff records</p>
        </div>
        <Button onClick={openCreate}>+ New Employee</Button>
      </div>

      <div className="mb-3">
        <input placeholder="Search by name or phone…" className="border border-gray-300 rounded-md px-3 py-2 text-sm w-72" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table
        keyFn={(e) => e.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Code", render: (e) => e.employeeCode },
          { header: "Name", render: (e) => e.name },
          { header: "Role", render: (e) => e.role },
          { header: "Department", render: (e) => e.department ?? "-" },
          { header: "Phone", render: (e) => e.phone },
          { header: "Joining Date", render: (e) => formatDate(e.joiningDate) },
          { header: "Salary", render: (e) => formatMoney(e.salary) },
          { header: "Status", render: (e) => (e.status === "Active" ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>) },
          {
            header: "Actions", render: (e) => (
              <div className="flex gap-2">
                <button className="text-blue-600 text-xs" onClick={() => openEdit(e)}>Edit</button>
                {e.status === "Active" && <button className="text-red-600 text-xs" onClick={() => setDeactivating(e)}>Deactivate</button>}
              </div>
            )
          },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Employee" : "New Employee"} wide>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-4">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="CNIC" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
          <Input label="Role" required list="role-options" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <datalist id="role-options">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
          <Input label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <Input label="Joining Date" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
          <Input label="Salary (Rs.)" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} />
          <TextArea label="Notes" className="col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title="Deactivate Employee"
        message={`Deactivate ${deactivating?.name}?`}
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
