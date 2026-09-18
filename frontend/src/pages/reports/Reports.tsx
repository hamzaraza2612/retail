import { useState } from "react";
import { api } from "../../api/client";
import { reportsApi } from "../../api/endpoints";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { formatMoney } from "../../lib/format";

type ReportKey =
  | "daily-sales" | "monthly-sales" | "sales-by-customer" | "sales-by-product" | "purchases"
  | "receivables" | "payables" | "inventory" | "expenses" | "profit-summary" | "payments" | "deliveries";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "daily-sales", label: "Daily Sales" },
  { key: "monthly-sales", label: "Monthly Sales" },
  { key: "sales-by-customer", label: "Sales by Customer" },
  { key: "sales-by-product", label: "Sales by Product" },
  { key: "purchases", label: "Purchases" },
  { key: "receivables", label: "Customer Receivables" },
  { key: "payables", label: "Supplier Payables" },
  { key: "inventory", label: "Inventory" },
  { key: "expenses", label: "Expenses" },
  { key: "profit-summary", label: "Profit Summary" },
  { key: "payments", label: "Customer Payments" },
  { key: "deliveries", label: "Delivery Report" },
];

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState<ReportKey>("daily-sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  function paramsFor() {
    const params: Record<string, unknown> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }

  async function runReport() {
    setLoading(true);
    try {
      const fn = (reportsApi as unknown as Record<string, (p: Record<string, unknown>) => Promise<{ data: unknown }>>)[
        reportKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      ];
      const res = await fn(paramsFor());
      setRows(res.data as typeof rows);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    const res = await api.get(`/reports/${reportKey}`, { params: { ...paramsFor(), format: "csv" }, responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportKey}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  const isList = Array.isArray(rows);
  const columns = isList && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Generate, view and export business reports</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Report" value={reportKey} onChange={(e) => { setReportKey(e.target.value as ReportKey); setRows(null); }} className="w-56">
            {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={runReport} disabled={loading}>{loading ? "Loading…" : "Run Report"}</Button>
          {isList && rows.length > 0 && <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        </div>
      </Card>

      {rows && !isList && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">Profit Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(rows as Record<string, number>).map(([k, v]) => (
              <div key={k} className="border rounded-md p-3">
                <p className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</p>
                <p className="font-semibold text-gray-900">{formatMoney(v)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Note: Profit figures are estimates based on recorded purchase prices, not a full accounting reconciliation.</p>
        </Card>
      )}

      {isList && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  {columns.map((c) => <th key={c} className="py-1.5 pr-4 capitalize">{c.replace(/([A-Z])/g, " $1").trim()}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={columns.length || 1} className="py-4 text-gray-400">No data for the selected range. Click "Run Report".</td></tr>}
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => <td key={c} className="py-1.5 pr-4">{String((row as Record<string, unknown>)[c] ?? "-")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
