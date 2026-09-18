import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { expensesApi } from "../../api/endpoints";
import type { Expense, ExpenseCategory, PaymentMethod } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { formatMoney, formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

export default function ExpensesList() {
  const [data, setData] = useState<{ items: Expense[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(0);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [description, setDescription] = useState("");
  const [receiptReference, setReceiptReference] = useState("");

  function load() {
    setLoading(true);
    expensesApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);
  useEffect(() => { expensesApi.categories().then((res) => setCategories(res.data)); }, []);

  function openCreate() {
    setCategoryId(categories[0]?.id ?? 0);
    setAmount(0);
    setDate(new Date().toISOString().slice(0, 10));
    setPaidBy("");
    setMethod("Cash");
    setDescription("");
    setReceiptReference("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId || amount <= 0 || !description) {
      toast.error("Please fill category, amount and description");
      return;
    }
    setSaving(true);
    try {
      await expensesApi.create({ categoryId, amount, date, paidBy: paidBy || undefined, paymentMethod: method, description, receiptReference: receiptReference || undefined });
      toast.success("Expense recorded");
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
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">Track daily business expenses</p>
        </div>
        <Button onClick={openCreate}>+ New Expense</Button>
      </div>

      <Table
        keyFn={(e) => e.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Date", render: (e) => formatDate(e.date) },
          { header: "Category", render: (e) => e.categoryName },
          { header: "Description", render: (e) => e.description },
          { header: "Amount", render: (e) => formatMoney(e.amount) },
          { header: "Paid By", render: (e) => e.paidBy ?? "-" },
          { header: "Method", render: (e) => e.paymentMethod },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Expense">
        <form onSubmit={handleSubmit}>
          <Select label="Category" required value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Amount (Rs.)" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label="Paid By" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
          <Select label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Receipt Reference" value={receiptReference} onChange={(e) => setReceiptReference(e.target.value)} />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Expense"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
