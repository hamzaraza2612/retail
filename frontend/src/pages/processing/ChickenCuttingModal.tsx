import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { processingBatchesApi, productsApi } from "../../api/endpoints";
import type { Product } from "../../api/types";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const BALANCE_TOLERANCE_KG = 0.01;

// The seven cuts this business actually produces from raw chicken. Matched by name against
// the existing finished-product catalog rather than hard-coding product IDs, so this keeps
// working if the catalog's SKUs ever change — a row just doesn't render if no matching
// active finished product exists.
const CUT_ROWS: { label: string; match: (name: string) => boolean }[] = [
  { label: "Boneless", match: (n) => n.includes("boneless") },
  { label: "Breast", match: (n) => n.includes("breast") },
  { label: "Tikka", match: (n) => n.includes("tikka") },
  { label: "Leg", match: (n) => n.includes("leg") },
  { label: "Wings", match: (n) => n.includes("wing") },
  { label: "Neck", match: (n) => n.includes("neck") },
  { label: "Whole Chicken", match: (n) => n.includes("whole chicken") },
];

interface SavedCutting {
  rawConsumed: number;
  finishedAdded: number;
  waste: number;
  costPerKg: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ChickenCuttingModal({ open, onClose, onSaved }: Props) {
  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);

  const [inputQuantity, setInputQuantity] = useState(0);
  const [cutQuantities, setCutQuantities] = useState<Record<string, number>>({});
  const [wasteQuantity, setWasteQuantity] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedCutting | null>(null);

  useEffect(() => {
    if (!open) return;
    productsApi.list({ active: true, pageSize: 200 }).then((res) => {
      setRawMaterials(res.data.items.filter((p) => p.productType === "RawMaterial"));
      setFinishedProducts(res.data.items.filter((p) => p.productType === "FinishedProduct"));
    });
  }, [open]);

  function resetForm() {
    setInputQuantity(0);
    setCutQuantities({});
    setWasteQuantity(0);
    setSaved(null);
  }
  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rawMaterial = rawMaterials[0];
  const cutRows = CUT_ROWS
    .map((row) => ({ ...row, product: finishedProducts.find((p) => row.match(p.name.toLowerCase())) }))
    .filter((row) => row.product);

  const finishedOutput = cutRows.reduce((sum, row) => sum + (cutQuantities[row.label] || 0), 0);
  const difference = inputQuantity - (finishedOutput + wasteQuantity);
  const balanced = Math.abs(difference) <= BALANCE_TOLERANCE_KG;
  const yieldPercent = inputQuantity > 0 ? (finishedOutput / inputQuantity) * 100 : null;
  const canComplete = !!rawMaterial && inputQuantity > 0 && finishedOutput > 0 && balanced;

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!rawMaterial) {
      toast.error("No raw chicken product is configured.");
      return;
    }
    if (inputQuantity <= 0) {
      toast.error("Enter how much raw chicken is going into this cutting.");
      return;
    }
    if (finishedOutput <= 0) {
      toast.error("Enter the quantity produced for at least one finished product.");
      return;
    }
    if (!balanced) {
      toast.error("Raw input must equal finished output plus waste before this can be completed.");
      return;
    }

    setSaving(true);
    let createdId: number | null = null;
    try {
      const createRes = await processingBatchesApi.create({
        inputs: [{ productId: rawMaterial.id, quantity: inputQuantity }],
        outputs: cutRows
          .filter((row) => (cutQuantities[row.label] || 0) > 0)
          .map((row) => ({ productId: row.product!.id, quantity: cutQuantities[row.label] })),
        wasteQuantity,
      });
      createdId = createRes.data.id;

      const completedRes = await processingBatchesApi.updateStatus(createdId, "Completed");
      const batch = completedRes.data;

      setSaved({
        rawConsumed: batch.totalInputQuantity,
        finishedAdded: batch.totalOutputQuantity,
        waste: batch.wasteQuantity,
        costPerKg: batch.outputs[0]?.unitCost ?? null,
      });
      onSaved();
    } catch (err) {
      if (createdId != null) {
        await processingBatchesApi.updateStatus(createdId, "Cancelled").catch(() => {});
      }
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={saved ? "Cutting Completed" : "Chicken Cutting"} wide>
      {saved ? (
        <div>
          <p className="text-green-700 font-semibold text-lg mb-4">Cutting Completed</p>
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div><p className="text-xs text-gray-500">Raw Chicken Consumed</p><p className="font-semibold">{saved.rawConsumed} KG</p></div>
            <div><p className="text-xs text-gray-500">Finished Stock Added</p><p className="font-semibold">{saved.finishedAdded} KG</p></div>
            <div><p className="text-xs text-gray-500">Waste</p><p className="font-semibold">{saved.waste} KG</p></div>
            <div>
              <p className="text-xs text-gray-500">Estimated Cost/KG</p>
              <p className="font-semibold">{saved.costPerKg != null ? formatMoney(saved.costPerKg) : "-"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={resetForm}>New Cutting</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Step 1 · Raw Chicken</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 sm:items-end bg-gray-50 border border-gray-200 rounded-md p-3">
              <div>
                <p className="text-xs text-gray-500">Raw Chicken Available</p>
                <p className="font-semibold text-gray-900">{rawMaterial ? `${rawMaterial.currentStock} ${rawMaterial.unit}` : "-"}</p>
              </div>
              <Input
                label="Input (KG)" aria-label="Input KG" type="number" step="0.001" required
                value={inputQuantity || ""} onChange={(e) => setInputQuantity(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Step 2 · Finished Products</p>
            <div className="space-y-2">
              {cutRows.map((row) => (
                <div key={row.label} className="grid grid-cols-2 gap-x-4 items-center">
                  <span className="text-sm text-gray-700">{row.label}</span>
                  <Input
                    aria-label={`${row.label} Quantity`} type="number" step="0.001" placeholder="Quantity (KG)"
                    value={cutQuantities[row.label] || ""}
                    onChange={(e) => setCutQuantities((prev) => ({ ...prev, [row.label]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Step 3 · Waste / Loss</p>
            <Input
              label="Waste/Loss (KG)" aria-label="Waste Loss KG" type="number" step="0.001"
              value={wasteQuantity || ""} onChange={(e) => setWasteQuantity(Number(e.target.value))}
            />
          </div>

          <div className={`mt-4 rounded-md border p-3 text-sm grid grid-cols-2 sm:grid-cols-5 gap-2 ${balanced ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
            <div><p className="text-xs text-gray-500">Raw Input</p><p className="font-semibold">{inputQuantity} KG</p></div>
            <div><p className="text-xs text-gray-500">Finished Output</p><p className="font-semibold">{finishedOutput} KG</p></div>
            <div><p className="text-xs text-gray-500">Waste</p><p className="font-semibold">{wasteQuantity} KG</p></div>
            <div><p className="text-xs text-gray-500">Difference</p><p className={`font-semibold ${balanced ? "text-green-700" : "text-amber-700"}`}>{difference.toFixed(3)} KG</p></div>
            <div><p className="text-xs text-gray-500">Yield %</p><p className="font-semibold">{yieldPercent != null ? `${Math.round(yieldPercent)}%` : "-"}</p></div>
          </div>
          <p className={`mt-2 text-center font-bold tracking-wide ${balanced ? "text-green-700" : "text-amber-700"}`}>
            {balanced ? "BALANCED" : "NOT BALANCED"}
          </p>
          {!balanced && (
            <p className="text-xs text-amber-600 mt-1 text-center">
              Raw input must equal finished output plus waste before cutting can be completed.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4 sticky bottom-0 -mx-5 px-5 py-3 bg-white border-t">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !canComplete}>{saving ? "Completing…" : "COMPLETE CUTTING"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
