import { useEffect, useState } from "react";
import { purchasesApi } from "../../api/endpoints";
import type { Purchase } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import { formatMoney, formatDate } from "../../lib/format";
import Badge from "../../components/ui/Badge";
import NewPurchaseModal from "./NewPurchaseModal";

export default function PurchasesList() {
  const [data, setData] = useState<{ items: Purchase[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    setLoading(true);
    purchasesApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500">Record incoming stock from suppliers</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Purchase</Button>
      </div>

      <Table
        keyFn={(p) => p.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Purchase #", render: (p) => p.purchaseNumber },
          { header: "Date", render: (p) => formatDate(p.purchaseDate) },
          { header: "Supplier", render: (p) => p.supplierName },
          { header: "Total", render: (p) => formatMoney(p.totalAmount) },
          { header: "Paid", render: (p) => formatMoney(p.paidAmount) },
          { header: "Remaining", render: (p) => <span className={p.remainingAmount > 0 ? "text-red-600" : ""}>{formatMoney(p.remainingAmount)}</span> },
          { header: "Status", render: (p) => <Badge value={p.status} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <NewPurchaseModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
