import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { usersApi, employeesApi } from "../../api/endpoints";
import type { User, UserRole, Employee } from "../../api/types";
import Table from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { formatDateTime } from "../../lib/format";
import { errorMessage } from "../../api/client";

const ROLES: UserRole[] = ["Admin", "Manager", "Sales", "Cashier", "StoreKeeper", "Delivery"];

export default function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [form, setForm] = useState({ username: "", email: "", password: "", fullName: "", role: "Sales" as UserRole, phone: "", isActive: true, employeeId: "" as number | "" });

  function load() {
    setLoading(true);
    usersApi.list().then((res) => setUsers(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => { employeesApi.list({ status: "Active", pageSize: 200 }).then((res) => setEmployees(res.data.items)); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ username: "", email: "", password: "", fullName: "", role: "Sales", phone: "", isActive: true, employeeId: "" });
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ username: u.username, email: u.email, password: "", fullName: u.fullName, role: u.role, phone: u.phone ?? "", isActive: u.isActive, employeeId: u.employeeId ?? "" });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const employeeId = form.employeeId === "" ? null : form.employeeId;
      if (editing) {
        await usersApi.update(editing.id, { fullName: form.fullName, role: form.role, phone: form.phone, isActive: form.isActive, employeeId });
        toast.success("User updated");
      } else {
        await usersApi.create({ username: form.username, email: form.email, password: form.password, fullName: form.fullName, role: form.role, phone: form.phone, employeeId });
        toast.success("User created");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await usersApi.resetPassword(resetTarget.id, newPassword);
      toast.success("Password updated. Any previously issued sessions for this user are now invalid.");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function deactivate(u: User) {
    try {
      await usersApi.deactivate(u.id);
      toast.success("User deactivated");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const showEmployeeField = form.role === "Delivery";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users & Roles</h1>
          <p className="text-sm text-gray-500">Manage system access for staff</p>
        </div>
        <Button onClick={openCreate}>+ New User</Button>
      </div>

      <Table
        keyFn={(u) => u.id}
        loading={loading}
        rows={users}
        columns={[
          { header: "Username", render: (u) => u.username },
          { header: "Full Name", render: (u) => u.fullName },
          { header: "Email", render: (u) => u.email },
          { header: "Role", render: (u) => u.role },
          { header: "Linked Employee", render: (u) => u.employeeName ?? "-" },
          { header: "Last Login", render: (u) => formatDateTime(u.lastLoginAt) },
          { header: "Status", render: (u) => (u.isActive ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>) },
          {
            header: "Actions", render: (u) => (
              <div className="flex gap-2">
                <button className="text-blue-600 text-xs" onClick={() => openEdit(u)}>Edit</button>
                <button className="text-amber-600 text-xs" onClick={() => setResetTarget(u)}>Reset Password</button>
                {u.isActive && <button className="text-red-600 text-xs" onClick={() => deactivate(u)}>Deactivate</button>}
              </div>
            )
          },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit User" : "New User"}>
        <form onSubmit={handleSubmit}>
          {!editing && (
            <>
              <Input label="Username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Password" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </>
          )}
          <Input label="Full Name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {showEmployeeField && (
            <Select
              label="Linked Employee (driver)"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value ? Number(e.target.value) : "" })}
            >
              <option value="">Not linked — required to see any deliveries</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
            </Select>
          )}
          {editing && (
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
            </label>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset Password: ${resetTarget?.username}`}>
        <form onSubmit={handleResetPassword}>
          <Input label="New Password" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <p className="text-xs text-gray-400 mb-2">This immediately signs the user out of any device they're already logged in on.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit">Update Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
