import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { purchasesApi, suppliersApi, productsApi } from "../../api/endpoints";
import type { Supplier, Product } from "../../api/types";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { formatMoney, toInputDate } from "../../lib/format";
import { errorMessage } from "../../api/client";

type PaymentStatus = "Paid" | "Partial" | "Unpaid";

interface SavedPurchase {
  productName: string;
  quantity: number;
  unit: string;
  total: number;
  supplierId: number;
  supplierName: string;
  supplierBalance: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// One product per purchase, one clear Paid/Partial/Unpaid choice instead of a raw amount to
// type — the common case for this business is buying raw chicken from one supplier at a
// time, so that's what this form is built around (see the Raw Materials group placed first
// in the product list below). Everything this actually writes — stock, the supplier's
// ledger, and each unit's historical cost — still goes through the same, unmodified
// purchasesApi.create call and PurchasesController; nothing about what gets recorded or how
// it's costed has changed, only how many fields a store keeper has to fill in to get there.
export default function NewPurchaseModal({ open, onClose, onSaved }: Props) {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [productId, setProductId] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [rate, setRate] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Unpaid");
  const [partialAmount, setPartialAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedPurchase | null>(null);

  useEffect(() => {
    if (!open) return;
    suppliersApi.list({ active: true, pageSize: 200 }).then((res) => setSuppliers(res.data.items));
    productsApi.list({ active: true, pageSize: 200 }).then((res) => setProducts(res.data.items));
  }, [open]);

  const rawMaterials = products.filter((p) => p.productType === "RawMaterial");
  const finishedProducts = products.filter((p) => p.productType === "FinishedProduct");
  const product = products.find((p) => p.id === productId);
  const total = quantity * rate;
  const paidAmount = paymentStatus === "Paid" ? total : paymentStatus === "Unpaid" ? 0 : partialAmount;

  function resetForm() {
    setSupplierId(0);
    setPurchaseDate(toInputDate(new Date().toISOString()));
    setProductId(0);
    setQuantity(0);
    setRate(0);
    setPaymentStatus("Unpaid");
    setPartialAmount(0);
    setNotes("");
    setSaved(null);
  }
  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Raw chicken is overwhelmingly this business's most common purchase, so once the product
  // list loads, default straight to the first raw material rather than making the store
  // keeper pick it every time — they can still change it for anything else they buy.
  useEffect(() => {
    if (products.length === 0 || productId !== 0) return;
    const defaultProduct = rawMaterials[0] ?? products[0];
    setProductId(defaultProduct.id);
    setRate(defaultProduct.purchasePrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!supplierId) {
      toast.error("Please select a supplier.");
      return;
    }
    if (!productId) {
      toast.error("Please select a product.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    if (paymentStatus === "Partial" && (partialAmount <= 0 || partialAmount > total)) {
      toast.error(`Amount paid must be between 0 and the total of ${formatMoney(total)}.`);
      return;
    }

    setSaving(true);
    try {
      const res = await purchasesApi.create({
        supplierId,
        purchaseDate: purchaseDate || undefined,
        items: [{ productId, quantity, rate }],
        paidAmount,
        notes: notes || undefined,
      });
      const purchase = res.data;

      let supplierBalance: number | null = null;
      try {
        const supplierRes = await suppliersApi.get(supplierId);
        supplierBalance = supplierRes.data.currentBalance;
      } catch {
        // The purchase itself already saved — a failed balance refresh isn't a reason to
        // tell the user the purchase failed.
      }

      setSaved({
        productName: product?.name ?? "",
        quantity,
        unit: product?.unit ?? "",
        total: purchase.totalAmount,
        supplierId,
        supplierName: purchase.supplierName,
        supplierBalance,
      });
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={saved ? "Purchase Saved" : "New Purchase"} wide>
      {saved ? (
        <div>
          <p className="text-green-700 font-semibold text-lg mb-4">Purchase Saved</p>
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div className="col-span-2">
              <p className="text-xs text-gray-500">{saved.productName} Added</p>
              <p className="font-semibold">{saved.quantity} {saved.unit}</p>
            </div>
            <div><p className="text-xs text-gray-500">Total</p><p className="font-semibold">{formatMoney(saved.total)}</p></div>
            <div>
              <p className="text-xs text-gray-500">Supplier Balance</p>
              <p className={`font-semibold ${(saved.supplierBalance ?? 0) > 0 ? "text-red-600" : ""}`}>
                {saved.supplierBalance != null ? formatMoney(saved.supplierBalance) : "-"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { navigate(`/suppliers/${saved.supplierId}`); onClose(); }}>View Supplier</Button>
            <Button onClick={resetForm}>New Purchase</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Select label="Supplier" aria-label="Supplier" required value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              <option value={0}>Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>

          <Select
            label="Product" aria-label="Product" required value={productId} className="mt-1"
            onChange={(e) => {
              const p = products.find((pr) => pr.id === Number(e.target.value));
              setProductId(Number(e.target.value));
              setRate(p?.purchasePrice ?? 0);
            }}
          >
            <option value={0}>Select product…</option>
            {rawMaterials.length > 0 && (
              <optgroup label="Raw Materials">
                {rawMaterials.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </optgroup>
            )}
            {finishedProducts.length > 0 && (
              <optgroup label="Finished Products">
                {finishedProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </optgroup>
            )}
          </Select>
          {product && <p className="text-xs text-gray-400 mt-0.5">Current stock: {product.currentStock} {product.unit}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-3">
            <Input
              label={`Quantity ${product?.unit ? `(${product.unit})` : ""}`} aria-label="Quantity" type="number" step="0.001" required
              value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <div>
              <Input
                label={`Purchase Rate / ${product?.unit ?? "unit"} (Rs.)`} aria-label="Purchase Rate" type="number" step="0.01" required
                value={rate || ""} onChange={(e) => setRate(Number(e.target.value))}
              />
              {product && rate !== product.purchasePrice && (
                <p className="text-xs text-gray-400 -mt-2 mb-2">Catalog reference price is {formatMoney(product.purchasePrice)} — this only records today's actual rate.</p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mt-1 text-sm">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold text-gray-900">{formatMoney(total)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-3 items-start">
            <Select label="Payment Status" aria-label="Payment Status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partially Paid</option>
              <option value="Paid">Paid in Full</option>
            </Select>
            {paymentStatus === "Partial" && (
              <Input
                label="Amount Paid (Rs.)" aria-label="Amount Paid" type="number" step="0.01" required
                value={partialAmount || ""} onChange={(e) => setPartialAmount(Number(e.target.value))}
              />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {paymentStatus === "Paid" && "Full amount recorded as paid to the supplier now."}
            {paymentStatus === "Unpaid" && "Nothing paid yet — the full amount goes onto the supplier's outstanding balance."}
            {paymentStatus === "Partial" && `Remaining payable: ${formatMoney(Math.max(0, total - partialAmount))}.`}
          </p>

          <Input label="Notes (optional)" className="mt-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. delivered by driver, weighed at shop" />

          <div className="flex justify-end gap-2 mt-4 sticky bottom-0 -mx-5 px-5 py-3 bg-white border-t">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Purchase"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
