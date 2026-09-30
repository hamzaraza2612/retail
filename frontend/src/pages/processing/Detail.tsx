import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { processingBatchesApi } from "../../api/endpoints";
import type { ProcessingBatch, ProcessingBatchStatus } from "../../api/types";
import { Card, StatCard } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { formatDate, formatMoney } from "../../lib/format";
import { errorMessage } from "../../api/client";

const NEXT_STATUS: Record<ProcessingBatchStatus, ProcessingBatchStatus[]> = {
  Draft: ["Completed", "Cancelled"],
  Completed: ["Cancelled"],
  Cancelled: [],
};

export default function ProcessingBatchDetailPage() {
  const { id } = useParams();
  const [batch, setBatch] = useState<ProcessingBatch | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<ProcessingBatchStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  function load() {
    if (!id) return;
    processingBatchesApi.get(Number(id)).then((res) => setBatch(res.data));
  }
  useEffect(load, [id]);

  async function handleStatusChange(status: ProcessingBatchStatus) {
    if (!batch || updating) return;
    setUpdating(true);
    try {
      await processingBatchesApi.updateStatus(batch.id, status);
      toast.success(`Processing batch moved to ${status}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
      setConfirmStatus(null);
      load();
    } finally {
      setUpdating(false);
    }
  }

  if (!batch) return <p className="text-gray-400">Loading…</p>;
  const nextOptions = NEXT_STATUS[batch.status];
  const outputTotal = batch.outputs.reduce((sum, o) => sum + o.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/processing" className="text-sm text-gray-500 hover:underline">&larr; Back to Processing</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{batch.batchNumber}</h1>
          <p className="text-sm text-gray-500">{formatDate(batch.processingDate)}</p>
        </div>
        <Badge value={batch.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Input" value={`${batch.totalInputQuantity} KG`} />
        <StatCard label="Output" value={`${batch.totalOutputQuantity} KG`} />
        <StatCard label="Waste" value={`${batch.wasteQuantity} ${batch.wasteUnit}`} />
        <StatCard label="Yield" value={batch.yieldPercent != null ? `${batch.yieldPercent}%` : "-"} />
        <StatCard label="Total Cost" value={formatMoney(batch.totalAllocatedCost)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {nextOptions.map((s) => (
          <Button key={s} variant={s === "Cancelled" ? "danger" : "primary"} disabled={updating} onClick={() => setConfirmStatus(s)}>
            Mark as {s}
          </Button>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Raw Material Input</h3>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="py-1.5 pr-4">Product</th><th className="py-1.5 pr-4">Quantity</th><th className="py-1.5 pr-4">Unit Cost</th><th className="py-1.5 pr-4">Total Cost</th>
          </tr></thead>
          <tbody>
            {batch.inputs.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-1.5 pr-4">{i.productName}</td>
                <td className="py-1.5 pr-4">{i.quantity} {i.unit}</td>
                <td className="py-1.5 pr-4">{formatMoney(i.unitCost)}</td>
                <td className="py-1.5 pr-4">{formatMoney(i.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Finished Products Produced</h3>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b">
            <th className="py-1.5 pr-4">Product</th><th className="py-1.5 pr-4">Quantity</th><th className="py-1.5 pr-4">% of Output</th>
            <th className="py-1.5 pr-4">Unit Cost</th><th className="py-1.5 pr-4">Allocated Cost</th>
          </tr></thead>
          <tbody>
            {batch.outputs.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-1.5 pr-4">{o.productName}</td>
                <td className="py-1.5 pr-4">{o.quantity} {o.unit}</td>
                <td className="py-1.5 pr-4">{outputTotal > 0 ? `${((o.quantity / outputTotal) * 100).toFixed(1)}%` : "-"}</td>
                <td className="py-1.5 pr-4">{o.unitCost > 0 ? formatMoney(o.unitCost) : "-"}</td>
                <td className="py-1.5 pr-4">{o.allocatedCost > 0 ? formatMoney(o.allocatedCost) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {batch.status === "Draft" && (
          <p className="text-xs text-gray-400 mt-2">Cost is allocated once this batch is completed.</p>
        )}
        {batch.wasteReason && <p className="text-xs text-gray-500 mt-3">Waste reason: {batch.wasteReason}</p>}
        {batch.notes && <p className="text-xs text-gray-500 mt-1">Notes: {batch.notes}</p>}
      </Card>

      <ConfirmDialog
        open={!!confirmStatus}
        title={`Mark batch as ${confirmStatus}`}
        message={
          confirmStatus === "Completed"
            ? "This will deduct the raw material, produce the finished products, and allocate cost across them. Continue?"
            : confirmStatus === "Cancelled" && batch.status === "Completed"
              ? "This will restore the raw material and remove the produced finished stock. It will fail if any of the produced stock has already been sold. Continue?"
              : `Change batch status to ${confirmStatus}?`
        }
        confirmLabel={updating ? "Working…" : "Confirm"}
        confirmDisabled={updating}
        danger={confirmStatus === "Cancelled"}
        onConfirm={() => confirmStatus && handleStatusChange(confirmStatus)}
        onCancel={() => setConfirmStatus(null)}
      />
    </div>
  );
}
