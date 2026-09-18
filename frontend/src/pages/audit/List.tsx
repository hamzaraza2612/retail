import { useEffect, useState } from "react";
import { auditLogsApi } from "../../api/endpoints";
import type { AuditLog } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import { formatDateTime } from "../../lib/format";

export default function AuditLogsList() {
  const [data, setData] = useState<{ items: AuditLog[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 30;

  useEffect(() => {
    setLoading(true);
    auditLogsApi.list({ page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500">Full record of important actions taken in the system</p>
      </div>

      <Table
        keyFn={(a) => a.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Timestamp", render: (a) => formatDateTime(a.timestamp) },
          { header: "User", render: (a) => a.userName ?? "system" },
          { header: "Action", render: (a) => a.action },
          { header: "Entity", render: (a) => `${a.entity}${a.entityId ? ` #${a.entityId}` : ""}` },
          { header: "Description", render: (a) => a.description ?? "-" },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />
    </div>
  );
}
