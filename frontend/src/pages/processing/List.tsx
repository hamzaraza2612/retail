import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { processingBatchesApi } from "../../api/endpoints";
import type { ProcessingBatch, ProcessingBatchStatus } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { formatDate, formatMoney } from "../../lib/format";
import ChickenCuttingModal from "./ChickenCuttingModal";

const STATUSES: ProcessingBatchStatus[] = ["Draft", "Completed", "Cancelled"];

export default function ProcessingBatchesList() {
  const [data, setData] = useState<{ items: ProcessingBatch[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    setLoading(true);
    processingBatchesApi.list({ status: status || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Processing / Cutting</h1>
          <p className="text-sm text-gray-500">Turn raw chicken into finished cuts and track yield &amp; cost</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Cutting</Button>
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

      <ChickenCuttingModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
