import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoicesApi } from "../../api/endpoints";
import type { Invoice } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { formatMoney, formatDate } from "../../lib/format";

export default function InvoicesList() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ items: Invoice[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    invoicesApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500">All generated customer invoices</p>
      </div>

      <Table
        keyFn={(i) => i.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Invoice #", render: (i) => i.invoiceNumber },
          { header: "Date", render: (i) => formatDate(i.invoiceDate) },
          { header: "Customer", render: (i) => i.customerName },
          { header: "Order #", render: (i) => i.orderNumber },
          { header: "Grand Total", render: (i) => formatMoney(i.grandTotal) },
          { header: "Balance", render: (i) => <span className={i.balanceAmount > 0 ? "text-red-600" : ""}>{formatMoney(i.balanceAmount)}</span> },
          { header: "Status", render: (i) => <Badge value={i.paymentStatus} /> },
          { header: "", render: (i) => <Button size="sm" variant="secondary" onClick={() => navigate(`/invoices/${i.id}/print`)}>View</Button> },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />
    </div>
  );
}
