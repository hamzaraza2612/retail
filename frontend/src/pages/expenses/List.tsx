import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { expensesApi } from "../../api/endpoints";
import type { Expense, ExpenseCategory } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { formatMoney, formatDate, toInputDate } from "../../lib/format";
import { errorMessage } from "../../api/client";

// The categories this business actually records expenses against most often — floated to
// the top of the picker so the common case needs no scrolling. Every other category the
// backend already has (Rent, Fuel, Salaries, etc.) still shows below them — nothing is
// hidden, just reordered. Matched by name rather than by ID, since the category list itself
// is backend reference data this task doesn't touch.
const PRIORITY_CATEGORY_SYNONYMS: Record<string, string[]> = {
  Electricity: ["electricity"],
  Transport: ["transport"],
  Ice: ["ice"],
  Packaging: ["packaging"],
  Labour: ["labour", "labor", "salaries", "salary", "wages"],
  Other: ["other", "miscellaneous", "misc"],
};
const PRIORITY_ORDER = Object.keys(PRIORITY_CATEGORY_SYNONYMS);

function priorityRank(categoryName: string): number {
  const lower = categoryName.toLowerCase();
  const index = PRIORITY_ORDER.findIndex((label) =>
    PRIORITY_CATEGORY_SYNONYMS[label].some((synonym) => lower === synonym || lower.includes(synonym))
  );
  return index === -1 ? PRIORITY_ORDER.length : index;
}

function sortCategories(categories: ExpenseCategory[]): ExpenseCategory[] {
  return [...categories].sort((a, b) => priorityRank(a.name) - priorityRank(b.name) || a.name.localeCompare(b.name));
}

export default function ExpensesList() {
  const [data, setData] = useState<{ items: Expense[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(0);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [description, setDescription] = useState("");

  function load() {
    setLoading(true);
    expensesApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);
  useEffect(() => {
    expensesApi.categories().then((res) => setCategories(sortCategories(res.data)));
  }, []);

  function resetForm() {
    setCategoryId(0);
    setAmount(0);
    setDate(toInputDate(new Date().toISOString()));
    setDescription("");
  }
  useEffect(() => {
    if (categories.length > 0 && categoryId === 0) setCategoryId(categories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!categoryId || amount <= 0 || !description) {
      toast.error("Please fill category, amount and description");
      return;
    }
    setSaving(true);
    try {
      // Payment Method isn't part of this simplified form — every expense recorded here is
      // assumed paid in cash on the day, the overwhelmingly common case for this business;
      // nothing about how the amount is recorded or totalled changes.
      await expensesApi.create({ categoryId, amount, date, paymentMethod: "Cash", description });
      toast.success("Expense recorded");
      resetForm();
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
        <p className="text-sm text-gray-500">Track daily business expenses</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <Input label="Date" aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Category" aria-label="Category" required value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value={0}>Select category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Amount (Rs.)" aria-label="Amount" type="number" step="0.01" required value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
          <Input label="Description" aria-label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Ice for the day" />
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Expense"}</Button>
        </form>
      </Card>

      <Table
        keyFn={(e) => e.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Date", render: (e) => formatDate(e.date) },
          { header: "Category", render: (e) => e.categoryName },
          { header: "Description", render: (e) => e.description },
          { header: "Amount", render: (e) => formatMoney(e.amount) },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />
    </div>
  );
}
