import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { usersApi } from "../../api/endpoints";
import type { User, UserRole } from "../../api/types";
import Table from "../../components/ui/Table";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { formatDateTime } from "../../lib/format";
import { errorMessage } from "../../api/client";

const ROLES: UserRole[] = ["Admin", "Manager", "Sales", "Cashier", "StoreKeeper", "Delivery"];

export default function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [form, setForm] = useState({ username: "", email: "", password: "", fullName: "", role: "Sales" as UserRole, phone: "", isActive: true });

  function load() {
    setLoading(true);
    usersApi.list().then((res) => setUsers(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm({ username: "", email: "", password: "", fullName: "", role: "Sales", phone: "", isActive: true });
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ username: u.username, email: u.email, password: "", fullName: u.fullName, role: u.role, phone: u.phone ?? "", isActive: u.isActive });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(editing.id, { fullName: form.fullName, role: form.role, phone: form.phone, isActive: form.isActive });
        toast.success("User updated");
      } else {
        await usersApi.create({ username: form.username, email: form.email, password: form.password, fullName: form.fullName, role: form.role, phone: form.phone });
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
      toast.success("Password updated");
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
              <Input label="Password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </>
          )}
          <Input label="Full Name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
          <Input label="New Password" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit">Update Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
