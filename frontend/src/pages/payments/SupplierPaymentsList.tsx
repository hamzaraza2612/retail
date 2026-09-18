import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { supplierPaymentsApi, suppliersApi, purchasesApi } from "../../api/endpoints";
import type { SupplierPayment, Supplier, Purchase, PaymentMethod } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import { formatMoney, formatDateTime } from "../../lib/format";
import { errorMessage } from "../../api/client";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

export default function SupplierPaymentsList() {
  const [data, setData] = useState<{ items: SupplierPayment[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<Purchase[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState(0);
  const [purchaseId, setPurchaseId] = useState<number | "">("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function load() {
    setLoading(true);
    supplierPaymentsApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);
  useEffect(() => { suppliersApi.list({ active: true, pageSize: 200 }).then((res) => setSuppliers(res.data.items)); }, []);

  useEffect(() => {
    if (!supplierId) { setSupplierPurchases([]); return; }
    purchasesApi.list({ supplierId, pageSize: 100 }).then((res) => setSupplierPurchases(res.data.items.filter((p) => p.remainingAmount > 0)));
  }, [supplierId]);

  function openCreate() {
    setSupplierId(suppliers[0]?.id ?? 0);
    setPurchaseId("");
    setAmount(0);
    setMethod("Cash");
    setReference("");
    setNotes("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierId || amount <= 0) {
      toast.error("Select supplier and enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await supplierPaymentsApi.create({ supplierId, purchaseId: purchaseId || undefined, amount, method, reference: reference || undefined, notes: notes || undefined });
      toast.success("Payment recorded, payable updated");
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
          <h1 className="text-xl font-bold text-gray-900">Supplier Payments</h1>
          <p className="text-sm text-gray-500">Payments made to suppliers against purchases</p>
        </div>
        <Button onClick={openCreate}>+ Record Payment</Button>
      </div>

      <Table
        keyFn={(p) => p.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Payment #", render: (p) => p.paymentNumber },
          { header: "Date", render: (p) => formatDateTime(p.paymentDate) },
          { header: "Supplier", render: (p) => p.supplierName },
          { header: "Purchase", render: (p) => p.purchaseNumber ?? "-" },
          { header: "Amount", render: (p) => <span className="text-red-700 font-medium">{formatMoney(p.amount)}</span> },
          { header: "Method", render: (p) => p.method },
          { header: "Reference", render: (p) => p.reference ?? "-" },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Supplier Payment">
        <form onSubmit={handleSubmit}>
          <Select label="Supplier" required value={supplierId} onChange={(e) => { setSupplierId(Number(e.target.value)); setPurchaseId(""); }}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} (Payable: {formatMoney(s.currentBalance)})</option>)}
          </Select>
          <Select label="Apply to Purchase (optional)" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">General payment (no specific purchase)</option>
            {supplierPurchases.map((p) => <option key={p.id} value={p.id}>{p.purchaseNumber} — Remaining {formatMoney(p.remainingAmount)}</option>)}
          </Select>
          <Input label="Amount (Rs.)" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
