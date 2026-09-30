import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { paymentsApi, customersApi } from "../../api/endpoints";
import type { Customer, PaymentMethod } from "../../api/types";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

// The Walk-in / Cash Customer is always settled at the point of sale (see NewSaleModal) —
// it never carries an outstanding balance, so it has no place in a "who still owes money"
// payment picker.
const CASH_CUSTOMER_CODE = "CASH-001";

interface SavedPayment {
  customerId: number;
  customerName: string;
  amount: number;
  remainingDue: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-select and lock this customer — used when launched from their own page. Omit these
   * three to show a customer picker instead — the general, standalone Receive Payment entry
   * point reachable from the Payments screen. */
  customerId?: number;
  customerName?: string;
  currentBalance?: number;
}

// The one "Receive Payment" screen for the whole app: paymentsApi.create is the same
// authoritative call (and the same customer-balance/invoice-balance rules enforced in
// PaymentsController) whether this opens with a customer already chosen or lets the person
// pick one — nothing here changes what the backend accepts or how it updates the ledger.
export default function ReceivePaymentModal({ open, onClose, onSaved, customerId, customerName, currentBalance }: Props) {
  const navigate = useNavigate();
  const isFixedCustomer = customerId != null;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pickedCustomerId, setPickedCustomerId] = useState(0);
  const [amount, setAmount] = useState(0);
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [referenceNote, setReferenceNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedPayment | null>(null);

  useEffect(() => {
    if (!open || isFixedCustomer) return;
    customersApi.list({ active: true, pageSize: 200 }).then((res) =>
      setCustomers(res.data.items.filter((c) => c.customerCode !== CASH_CUSTOMER_CODE))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isFixedCustomer]);

  function resetForm() {
    setPickedCustomerId(0);
    // For a fixed customer the outstanding balance is already known synchronously (it's a
    // prop); for the picker it starts at 0 until a customer is actually chosen, at which
    // point the effect below fills it in.
    setAmount(isFixedCustomer ? currentBalance ?? 0 : 0);
    setAmountTouched(false);
    setMethod("Cash");
    setReferenceNote("");
    setSaved(null);
  }
  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const effectiveCustomerId = customerId ?? pickedCustomerId;
  const outstandingBefore = isFixedCustomer ? currentBalance ?? 0 : customers.find((c) => c.id === pickedCustomerId)?.currentBalance ?? 0;
  const outstandingAfter = Math.max(0, outstandingBefore - amount);

  // Paying the full outstanding amount is the common case, so the field defaults to (and
  // keeps following) it — for a fixed customer that's known immediately; in the picker it
  // updates as soon as a customer is chosen — until the person deliberately types their own
  // amount, exactly like NewSaleModal's Cash Received field.
  useEffect(() => {
    if (!amountTouched) setAmount(outstandingBefore);
  }, [outstandingBefore, amountTouched]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return; // duplicate-submit guard, belt-and-braces alongside the disabled button below

    if (!effectiveCustomerId) {
      toast.error("Please select a customer.");
      return;
    }
    if (amount <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }
    if (amount > outstandingBefore) {
      toast.error(`Payment cannot exceed the current outstanding balance of ${formatMoney(outstandingBefore)}.`);
      return;
    }

    setSaving(true);
    try {
      const res = await paymentsApi.create({
        customerId: effectiveCustomerId, amount, method, reference: referenceNote || undefined,
      });

      // Re-fetch rather than assume: the customer's real balance is whatever the backend's
      // own ledger says it is now, not our own before-minus-amount arithmetic.
      let remainingDue = Math.max(0, outstandingBefore - amount);
      try {
        const customerRes = await customersApi.get(effectiveCustomerId);
        remainingDue = customerRes.data.customer.currentBalance;
      } catch {
        // The payment itself already saved successfully — a failed refresh of the display
        // figure is not a reason to tell the user the payment failed.
      }

      setSaved({ customerId: effectiveCustomerId, customerName: res.data.customerName, amount: res.data.amount, remainingDue });
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={saved ? "Payment Received" : "Receive Payment"}>
      {saved ? (
        <div>
          <p className="text-green-700 font-semibold text-lg mb-4">Payment Received</p>
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div><p className="text-xs text-gray-500">Customer</p><p className="font-semibold">{saved.customerName}</p></div>
            <div><p className="text-xs text-gray-500">Amount</p><p className="font-semibold">{formatMoney(saved.amount)}</p></div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Remaining Due</p>
              <p className={`font-semibold ${saved.remainingDue > 0 ? "text-red-600" : ""}`}>{formatMoney(saved.remainingDue)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { navigate(`/customers/${saved.customerId}`); onClose(); }}>View Customer</Button>
            <Button onClick={resetForm}>New Payment</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {isFixedCustomer ? (
            <p className="text-sm text-gray-600 mb-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              Customer: <span className="font-medium text-gray-800">{customerName}</span>
            </p>
          ) : (
            <Select label="Customer" aria-label="Customer" required value={pickedCustomerId} onChange={(e) => setPickedCustomerId(Number(e.target.value))}>
              <option value={0}>Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </Select>
          )}

          <div className="flex justify-between text-sm mt-3 mb-1">
            <span className="text-gray-600">Current Outstanding</span>
            <span className={`font-semibold ${outstandingBefore > 0 ? "text-red-600" : ""}`}>{formatMoney(outstandingBefore)}</span>
          </div>

          <Input
            label="Payment Amount (Rs.)" aria-label="Payment Amount" type="number" step="0.01" required className="mt-2"
            value={amount || ""} onChange={(e) => { setAmountTouched(true); setAmount(Number(e.target.value)); }}
          />

          <Select label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="mt-3">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>

          <Input
            label="Reference / Note (optional)" className="mt-3"
            value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="Cheque #, transaction ID, or a short note"
          />

          <div className="mt-4 border-t pt-3 space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-gray-600">Outstanding Before</span><span className="font-medium">{formatMoney(outstandingBefore)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Payment</span><span className="font-medium text-green-700">− {formatMoney(amount)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-1">
              <span>Outstanding After</span>
              <span className={outstandingAfter > 0 ? "text-red-600" : ""}>{formatMoney(outstandingAfter)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Receive Payment"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
