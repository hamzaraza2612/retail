import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { paymentsApi, customersApi, invoicesApi } from "../../api/endpoints";
import type { Payment, Customer, Invoice, PaymentMethod } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import { formatMoney, formatDateTime } from "../../lib/format";
import { errorMessage } from "../../api/client";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

export default function PaymentsList() {
  const [data, setData] = useState<{ items: Payment[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState(0);
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function load() {
    setLoading(true);
    paymentsApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);
  useEffect(() => { customersApi.list({ active: true, pageSize: 200 }).then((res) => setCustomers(res.data.items)); }, []);

  useEffect(() => {
    if (!customerId) { setCustomerInvoices([]); return; }
    invoicesApi.list({ customerId, pageSize: 100 }).then((res) => setCustomerInvoices(res.data.items.filter((i) => i.balanceAmount > 0)));
  }, [customerId]);

  function openCreate() {
    setCustomerId(customers[0]?.id ?? 0);
    setInvoiceId("");
    setAmount(0);
    setMethod("Cash");
    setReference("");
    setNotes("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerId || amount <= 0) {
      toast.error("Select customer and enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.create({ customerId, invoiceId: invoiceId || undefined, amount, method, reference: reference || undefined, notes: notes || undefined });
      toast.success("Payment recorded, balance updated");
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
          <h1 className="text-xl font-bold text-gray-900">Customer Payments</h1>
          <p className="text-sm text-gray-500">Payments received against invoices and accounts</p>
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
          { header: "Customer", render: (p) => p.customerName },
          { header: "Invoice", render: (p) => p.invoiceNumber ?? "-" },
          { header: "Amount", render: (p) => <span className="text-green-700 font-medium">{formatMoney(p.amount)}</span> },
          { header: "Method", render: (p) => p.method },
          { header: "Reference", render: (p) => p.reference ?? "-" },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Customer Payment">
        <form onSubmit={handleSubmit}>
          <Select label="Customer" required value={customerId} onChange={(e) => { setCustomerId(Number(e.target.value)); setInvoiceId(""); }}>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName} (Balance: {formatMoney(c.currentBalance)})</option>)}
          </Select>
          <Select label="Apply to Invoice (optional)" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">General payment (no specific invoice)</option>
            {customerInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — Balance {formatMoney(i.balanceAmount)}</option>)}
          </Select>
          <Input label="Amount (Rs.)" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, transaction ID, etc." />
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
