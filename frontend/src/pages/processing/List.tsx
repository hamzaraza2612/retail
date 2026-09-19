import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { processingBatchesApi, productsApi } from "../../api/endpoints";
import type { ProcessingBatch, ProcessingBatchStatus, Product } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import { Input, Select, TextArea } from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import { formatDate, formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

interface OutputLine { productId: number; quantity: number; }

const STATUSES: ProcessingBatchStatus[] = ["Draft", "Completed", "Cancelled"];

export default function ProcessingBatchesList() {
  const [data, setData] = useState<{ items: ProcessingBatch[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [rawMaterials, setRawMaterials] = useState<Product[]>([]);
  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [processingDate, setProcessingDate] = useState("");
  const [rawProductId, setRawProductId] = useState(0);
  const [inputQuantity, setInputQuantity] = useState(0);
  const [outputs, setOutputs] = useState<OutputLine[]>([{ productId: 0, quantity: 0 }]);
  const [wasteQuantity, setWasteQuantity] = useState(0);
  const [wasteReason, setWasteReason] = useState("");
  const [notes, setNotes] = useState("");

  function load() {
    setLoading(true);
    processingBatchesApi.list({ status: status || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);
  useEffect(() => {
    productsApi.list({ active: true, pageSize: 200 }).then((res) => {
      setRawMaterials(res.data.items.filter((p) => p.productType === "RawMaterial"));
      setFinishedProducts(res.data.items.filter((p) => p.productType === "FinishedProduct"));
    });
  }, []);

  const outputTotal = outputs.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const difference = inputQuantity - outputTotal - wasteQuantity;
  const balanced = Math.abs(difference) < 0.01;

  function openCreate() {
    setProcessingDate("");
    setRawProductId(rawMaterials[0]?.id ?? 0);
    setInputQuantity(0);
    setOutputs([{ productId: finishedProducts[0]?.id ?? 0, quantity: 0 }]);
    setWasteQuantity(0);
    setWasteReason("");
    setNotes("");
    setModalOpen(true);
  }

  function updateOutput(i: number, patch: Partial<OutputLine>) {
    setOutputs((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function addOutput() {
    setOutputs((prev) => [...prev, { productId: finishedProducts[0]?.id ?? 0, quantity: 0 }]);
  }
  function removeOutput(i: number) {
    setOutputs((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rawProductId || inputQuantity <= 0) {
      toast.error("Please select a raw material and enter a valid input quantity");
      return;
    }
    if (outputs.some((o) => !o.productId || o.quantity <= 0)) {
      toast.error("Please select a product and valid quantity for every output row");
      return;
    }
    setSaving(true);
    try {
      await processingBatchesApi.create({
        processingDate: processingDate || undefined,
        inputs: [{ productId: rawProductId, quantity: inputQuantity }],
        outputs: outputs.map((o) => ({ productId: o.productId, quantity: o.quantity })),
        wasteQuantity,
        wasteReason: wasteReason || undefined,
        notes: notes || undefined,
      });
      toast.success("Processing batch saved as Draft — complete it from the detail page to update stock");
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
          <h1 className="text-xl font-bold text-gray-900">Processing / Cutting</h1>
          <p className="text-sm text-gray-500">Turn raw chicken into finished cuts and track yield &amp; cost</p>
        </div>
        <Button onClick={openCreate}>+ New Processing Batch</Button>
      </div>

      <div className="mb-3">
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Table
        keyFn={(b) => b.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Batch #", render: (b) => <Link to={`/processing/${b.id}`} className="text-green-700 hover:underline">{b.batchNumber}</Link> },
          { header: "Date", render: (b) => formatDate(b.processingDate) },
          { header: "Input", render: (b) => `${b.totalInputQuantity} KG` },
          { header: "Output", render: (b) => `${b.totalOutputQuantity} KG` },
          { header: "Waste", render: (b) => `${b.wasteQuantity} ${b.wasteUnit}` },
          { header: "Yield", render: (b) => (b.yieldPercent != null ? `${b.yieldPercent}%` : "-") },
          { header: "Cost", render: (b) => formatMoney(b.totalAllocatedCost) },
          { header: "Status", render: (b) => <Badge value={b.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Processing Batch" wide>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-3 gap-x-4">
            <Input label="Date" type="date" value={processingDate} onChange={(e) => setProcessingDate(e.target.value)} />
            <Select label="Raw Product" required value={rawProductId} onChange={(e) => setRawProductId(Number(e.target.value))}>
              <option value={0}>Select raw material…</option>
              {rawMaterials.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} {p.unit} on hand)</option>)}
            </Select>
            <Input label="Input Quantity (KG)" type="number" step="0.001" value={inputQuantity || ""} onChange={(e) => setInputQuantity(Number(e.target.value))} />
          </div>

          <p className="text-sm font-medium text-gray-700 mt-3 mb-1">Outputs</p>
          <div className="space-y-2">
            {outputs.map((o, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select className="col-span-8 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  value={o.productId} onChange={(e) => updateOutput(i, { productId: Number(e.target.value) })}>
                  <option value={0}>Select product…</option>
                  {finishedProducts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
                <input type="number" step="0.001" placeholder="Qty" className="col-span-3 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  value={o.quantity || ""} onChange={(e) => updateOutput(i, { quantity: Number(e.target.value) })} />
                <button type="button" className="col-span-1 text-red-500 text-sm" onClick={() => removeOutput(i)} disabled={outputs.length === 1}>&times;</button>
              </div>
            ))}
          </div>
          <button type="button" className="text-sm text-green-700 mt-2" onClick={addOutput}>+ Add output</button>

          <div className="grid grid-cols-2 gap-x-4 mt-3">
            <Input label="Waste Quantity (KG)" type="number" step="0.001" value={wasteQuantity || ""} onChange={(e) => setWasteQuantity(Number(e.target.value))} />
            <Input label="Waste Reason" value={wasteReason} onChange={(e) => setWasteReason(e.target.value)} placeholder="e.g. Trimming loss" />
          </div>
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className={`mt-3 rounded-md border p-3 text-sm grid grid-cols-4 gap-2 ${balanced ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
            <div><p className="text-xs text-gray-500">Input Total</p><p className="font-semibold">{inputQuantity} KG</p></div>
            <div><p className="text-xs text-gray-500">Output Total</p><p className="font-semibold">{outputTotal} KG</p></div>
            <div><p className="text-xs text-gray-500">Waste</p><p className="font-semibold">{wasteQuantity} KG</p></div>
            <div><p className="text-xs text-gray-500">Difference</p><p className={`font-semibold ${balanced ? "text-green-700" : "text-amber-700"}`}>{difference.toFixed(3)} KG</p></div>
          </div>
          {!balanced && (
            <p className="text-xs text-amber-600 mt-1">
              Input must equal output + waste before this batch can be completed. You can still save it as a draft and fix it later.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save as Draft"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
