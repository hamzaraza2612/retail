import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { paymentsApi, invoicesApi } from "../../api/endpoints";
import type { Invoice, PaymentMethod } from "../../api/types";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customerId: number;
  customerName: string;
  currentBalance: number;
}

// This is exactly the same payment ledger the standalone Payments screen writes to
// (paymentsApi.create -> the customer's balance and any selected invoice's balance) — just
// reachable directly from the customer whose money is actually being collected, instead of
// requiring a trip to a separate screen and re-selecting them from a dropdown.
export default function ReceivePaymentModal({ open, onClose, onSaved, customerId, customerName, currentBalance }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInvoiceId("");
    setMethod("Cash");
    setReference("");
    setAmount(currentBalance > 0 ? currentBalance : 0);
    invoicesApi.list({ customerId, pageSize: 100 }).then((res) => setInvoices(res.data.items.filter((i) => i.balanceAmount > 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await paymentsApi.create({ customerId, invoiceId: invoiceId || undefined, amount, method, reference: reference || undefined });
      toast.success("Payment received — balance updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Receive Payment">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 mb-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          From <span className="font-medium text-gray-800">{customerName}</span> — currently owes{" "}
          <span className={`font-medium ${currentBalance > 0 ? "text-red-600" : ""}`}>{formatMoney(currentBalance)}</span>
        </p>

        <Select label="Apply to a specific sale (optional)" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">General payment (not tied to one sale)</option>
          {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber} — owes {formatMoney(i.balanceAmount)}</option>)}
        </Select>

        <Input
          label="Amount Received (Rs.)" aria-label="Amount Received" type="number" step="0.01" required className="mt-3"
          value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
        />

        <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="mt-3">
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>

        <Input
          label="Reference (optional)" className="mt-3"
          value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, transaction ID, etc."
        />

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Receive Payment"}</Button>
        </div>
      </form>
    </Modal>
  );
}
