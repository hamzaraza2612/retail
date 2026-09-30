import { useEffect, useState } from "react";
import { paymentsApi } from "../../api/endpoints";
import type { Payment } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Button from "../../components/ui/Button";
import { formatMoney, formatDateTime } from "../../lib/format";
import ReceivePaymentModal from "../customers/ReceivePaymentModal";

export default function PaymentsList() {
  const [data, setData] = useState<{ items: Payment[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [modalOpen, setModalOpen] = useState(false);

  function load() {
    setLoading(true);
    paymentsApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customer Payments</h1>
          <p className="text-sm text-gray-500">Payments received against invoices and accounts</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Receive Payment</Button>
      </div>

      <Table
        keyFn={(p) => p.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Payment #", render: (p) => p.paymentNumber },
          { header: "Date", render: (p) => formatDateTime(p.paymentDate) },
          { header: "Customer", render: (p) => p.customerName },
          { header: "Invoice", render: (p) => p.invoiceNumber ?? "-" },
          { header: "Amount", render: (p) => <span className="text-green-700 font-medium">{formatMoney(p.amount)}</span> },
          { header: "Method", render: (p) => p.method },
          { header: "Reference", render: (p) => p.reference ?? "-" },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />

      <ReceivePaymentModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
