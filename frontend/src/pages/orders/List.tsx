import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../../api/endpoints";
import type { SalesOrder, SalesOrderStatus } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import { formatMoney, formatDate, splitWords } from "../../lib/format";
import Badge from "../../components/ui/Badge";
import NewSaleModal from "./NewSaleModal";

const STATUSES: SalesOrderStatus[] = ["Draft", "Confirmed", "Processing", "Ready", "OutForDelivery", "Delivered", "Cancelled"];

export default function OrdersList() {
  const [data, setData] = useState<{ items: SalesOrder[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    setLoading(true);
    ordersApi.list({ status: status || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">Customer orders, from draft to delivery</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Sale</Button>
      </div>

      <div className="mb-3">
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{splitWords(s)}</option>)}
        </select>
      </div>

      <Table
        keyFn={(o) => o.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Order #", render: (o) => <Link to={`/orders/${o.id}`} className="text-green-700 font-medium">{o.orderNumber}</Link> },
          { header: "Date", render: (o) => formatDate(o.orderDate) },
          { header: "Customer", render: (o) => o.customerName },
          { header: "Total", render: (o) => formatMoney(o.grandTotal) },
          { header: "Remaining", render: (o) => <span className={o.remainingAmount > 0 ? "text-red-600" : ""}>{formatMoney(o.remainingAmount)}</span> },
          { header: "Status", render: (o) => <Badge value={o.status} /> },
          { header: "Payment", render: (o) => <Badge value={o.paymentStatus} /> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <NewSaleModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
