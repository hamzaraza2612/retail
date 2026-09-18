import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ordersApi, invoicesApi, paymentsApi, deliveriesApi, employeesApi } from "../../api/endpoints";
import type { SalesOrder, Invoice, SalesOrderStatus, PaymentMethod, Employee } from "../../api/types";
import { Card, StatCard } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { formatMoney, formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

const NEXT_STATUS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  Draft: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Ready", "Cancelled"],
  Ready: ["OutForDelivery", "Cancelled"],
  OutForDelivery: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "BankTransfer", "OnlineTransfer", "Cheque", "Other"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [confirmStatus, setConfirmStatus] = useState<SalesOrderStatus | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [driverId, setDriverId] = useState<number | "">("");
  const [vehicle, setVehicle] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!id) return;
    ordersApi.get(Number(id)).then((res) => {
      setOrder(res.data);
      if (res.data.status !== "Draft") {
        invoicesApi.list({ customerId: res.data.customerId, pageSize: 100 }).then((invRes) => {
          const match = invRes.data.items.find((i) => i.orderNumber === res.data.orderNumber);
          setInvoice(match ?? null);
          if (match) setAmount(match.balanceAmount);
        });
      }
    });
  }
  useEffect(load, [id]);
  useEffect(() => { employeesApi.list({ status: "Active", pageSize: 200 }).then((res) => setEmployees(res.data.items)); }, []);

  async function handleStatusChange(status: SalesOrderStatus) {
    if (!order) return;
    try {
      await ordersApi.updateStatus(order.id, status);
      toast.success(`Order moved to ${status}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handlePayment(e: FormEvent) {
    e.preventDefault();
    if (!order || !invoice) return;
    setSaving(true);
    try {
      await paymentsApi.create({ customerId: order.customerId, invoiceId: invoice.id, amount, method });
      toast.success("Payment recorded");
      setPayModalOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDelivery(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setSaving(true);
    try {
      await deliveriesApi.create({
        salesOrderId: order.id,
        driverEmployeeId: driverId || undefined,
        vehicle: vehicle || undefined,
        deliveryDate: order.deliveryDate,
      });
      toast.success("Delivery created");
      setDeliveryModalOpen(false);
      navigate("/deliveries");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!order) return <p className="text-gray-400">Loading…</p>;
  const nextOptions = NEXT_STATUS[order.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/orders" className="text-sm text-gray-500 hover:underline">&larr; Back to Orders</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500">
            <Link to={`/customers/${order.customerId}`} className="text-green-700">{order.customerName}</Link> &middot; {formatDate(order.orderDate)}
          </p>
        </div>
        <div className="flex gap-2 items-start flex-wrap justify-end">
          <Badge value={order.status} />
          <Badge value={order.paymentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Grand Total" value={formatMoney(order.grandTotal)} />
        <StatCard label="Paid" value={formatMoney(order.paidAmount)} />
        <StatCard label="Remaining" value={formatMoney(order.remainingAmount)} />
        <StatCard label="Delivery Date" value={order.deliveryDate ? formatDate(order.deliveryDate) : "-"} />
      </div>

      <div className="flex flex-wrap gap-2">
        {nextOptions.map((s) => (
          <Button key={s} variant={s === "Cancelled" ? "danger" : "primary"} onClick={() => setConfirmStatus(s)}>
            Mark as {s}
          </Button>
        ))}
        {invoice && (
          <>
            <Button variant="secondary" onClick={() => window.open(`/invoices/${invoice.id}/print`, "_blank")}>View / Print Invoice</Button>
            {invoice.balanceAmount > 0 && <Button variant="secondary" onClick={() => setPayModalOpen(true)}>Record Payment</Button>}
          </>
        )}
        {order.status !== "Draft" && order.status !== "Cancelled" && (
          <Button variant="secondary" onClick={() => setDeliveryModalOpen(true)}>Assign Delivery</Button>
        )}
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Items</h3>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="py-1.5 pr-4">Product</th><th className="py-1.5 pr-4">Quantity</th><th className="py-1.5 pr-4">Rate</th><th className="py-1.5 pr-4">Total</th>
          </tr></thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="py-1.5 pr-4">{it.productName}</td>
                <td className="py-1.5 pr-4">{it.quantity} {it.unit}</td>
                <td className="py-1.5 pr-4">{formatMoney(it.rate)}</td>
                <td className="py-1.5 pr-4">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-{formatMoney(order.discount)}</span></div>
          <div className="flex justify-between"><span>Delivery Charges</span><span>{formatMoney(order.deliveryCharges)}</span></div>
          <div className="flex justify-between font-semibold border-t pt-1"><span>Grand Total</span><span>{formatMoney(order.grandTotal)}</span></div>
        </div>
      </Card>

      <ConfirmDialog
        open={!!confirmStatus}
        title={`Mark order as ${confirmStatus}`}
        message={
          confirmStatus === "Confirmed"
            ? "This will deduct stock for all items and generate the customer invoice. Continue?"
            : confirmStatus === "Cancelled"
              ? "This will restore any deducted stock and reverse the outstanding balance. Continue?"
              : `Change order status to ${confirmStatus}?`
        }
        confirmLabel="Confirm"
        danger={confirmStatus === "Cancelled"}
        onConfirm={() => confirmStatus && handleStatusChange(confirmStatus)}
        onCancel={() => setConfirmStatus(null)}
      />

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payment">
        <form onSubmit={handlePayment}>
          <Input label="Amount (Rs.)" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setPayModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deliveryModalOpen} onClose={() => setDeliveryModalOpen(false)} title="Assign Delivery">
        <form onSubmit={handleCreateDelivery}>
          <Select label="Driver" value={driverId} onChange={(e) => setDriverId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Unassigned</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
          </Select>
          <Input label="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. LEA-1234" />
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setDeliveryModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Delivery"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
