import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { reportsApi } from "../../api/endpoints";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { formatMoney, formatDate } from "../../lib/format";

type ReportKey =
  | "daily-sales" | "monthly-sales" | "sales-by-customer" | "sales-by-product" | "purchases"
  | "receivables" | "payables" | "inventory" | "expenses" | "profit-summary" | "payments" | "deliveries"
  | "processing" | "yield" | "daily-stock" | "product-profit" | "daily-profit" | "cash-vs-credit";

const REPORTS: { key: ReportKey; label: string }[] = [
  { key: "daily-sales", label: "Daily Sales" },
  { key: "monthly-sales", label: "Monthly Sales" },
  { key: "sales-by-customer", label: "Sales by Customer" },
  { key: "sales-by-product", label: "Sales by Product" },
  { key: "purchases", label: "Purchases" },
  { key: "receivables", label: "Customer Due" },
  { key: "payables", label: "Supplier Due" },
  { key: "inventory", label: "Stock Report" },
  { key: "expenses", label: "Expenses" },
  { key: "profit-summary", label: "Profit Summary (Monthly)" },
  { key: "payments", label: "Customer Payments" },
  { key: "deliveries", label: "Delivery Report" },
  { key: "processing", label: "Processing Report" },
  { key: "yield", label: "Yield Report" },
  { key: "daily-stock", label: "Daily Stock Report" },
  { key: "product-profit", label: "Product Profit Report" },
  { key: "daily-profit", label: "Daily Profit / Loss" },
  { key: "cash-vs-credit", label: "Cash vs Credit Sales" },
];

// Reports keyed by a single point-in-time date rather than a from/to range.
const SINGLE_DATE_REPORTS: ReportKey[] = ["daily-stock", "daily-profit"];

// The business questions an owner actually opens Reports to answer, in the order they care
// about them. "Today's Business" and "Stock" already have their own dedicated, simplified
// pages, so those two are shortcuts rather than report runs; the rest jump straight into the
// existing report tool below with the right report pre-selected and already run. Nothing
// about the report tool itself — its data, its date filters, CSV export — changes; this is
// just a faster way to reach the reports people ask for most.
const QUICK_REPORTS: ({ label: string } & ({ kind: "link"; to: string } | { kind: "report"; key: ReportKey }))[] = [
  { label: "Today's Business", kind: "link", to: "/" },
  { label: "Stock", kind: "link", to: "/inventory" },
  { label: "Customer Due", kind: "report", key: "receivables" },
  { label: "Product Profit", kind: "report", key: "product-profit" },
  { label: "Processing/Yield", kind: "report", key: "yield" },
  { label: "Cash vs Credit", kind: "report", key: "cash-vs-credit" },
  { label: "Sales", kind: "report", key: "daily-sales" },
  { label: "Purchases", kind: "report", key: "purchases" },
  { label: "Expenses", kind: "report", key: "expenses" },
];

const quickReportClass =
  "flex items-center justify-center text-center font-semibold text-sm rounded-lg px-3 py-4 bg-green-600 text-white hover:bg-green-700 transition-colors";

// Two kinds of relabeling for these auto-generated column/summary headers: current costing
// is weight-based (see BUSINESS_WORKFLOW.md), so every profit-shaped number this app
// produces is an estimate, never a full accounting-grade actual profit — "Estimated" is
// always attached to those labels, not just buried in a footnote. The rest just swap
// accounting terms (Receivable/Payable/Outstanding) for the plain "Due" wording used
// everywhere else in the app. Nothing about the underlying figures changes.
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  grossProfit: "Estimated Gross Profit",
  totalCogs: "Estimated Cost of Goods Sold",
  estimatedCogs: "Estimated Cost of Goods Sold",
  estimatedCost: "Estimated Cost",
  operatingProfitLoss: "Estimated Operating Result",
  netEstimatedProfit: "Estimated Net Profit",
  outstandingBalance: "Due",
  outstandingReceivables: "Customer Due",
  outstandingPayables: "Supplier Due",
};

function labelFor(key: string): string {
  return FIELD_LABEL_OVERRIDES[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

const OBJECT_REPORT_META: Partial<Record<ReportKey, { title: string; note: string }>> = {
  "profit-summary": {
    title: "Profit Summary",
    note: "Note: Profit figures are estimates based on recorded purchase prices, not a full accounting reconciliation.",
  },
  "daily-profit": {
    title: "Daily Profit / Loss",
    note: "Estimated COGS is based on each sale's recorded cost snapshot at the moment stock left — see BUSINESS_WORKFLOW.md. This is an estimate, not a full accounting reconciliation.",
  },
  "cash-vs-credit": {
    title: "Cash vs Credit Sales",
    note: "Cash sales are orders billed to the standing Walk-in / Cash Customer; everything else counts as credit.",
  },
};

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState<ReportKey>("daily-sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  function paramsFor() {
    const params: Record<string, unknown> = {};
    if (SINGLE_DATE_REPORTS.includes(reportKey)) {
      if (from) params.date = from;
      return params;
    }
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }

  const isSingleDate = SINGLE_DATE_REPORTS.includes(reportKey);
  const objectMeta = OBJECT_REPORT_META[reportKey];

  async function fetchReport(key: ReportKey, params: Record<string, unknown>) {
    setLoading(true);
    try {
      const fn = (reportsApi as unknown as Record<string, (p: Record<string, unknown>) => Promise<{ data: unknown }>>)[
        key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      ];
      const res = await fn(params);
      setRows(res.data as typeof rows);
    } finally {
      setLoading(false);
    }
  }

  function runReport() {
    return fetchReport(reportKey, paramsFor());
  }

  // Used by the Quick Reports tiles: jumps the report tool straight to the requested report,
  // already run, without waiting on a state update to land first (setReportKey wouldn't be
  // visible to paramsFor() until the next render).
  function quickRun(key: ReportKey) {
    setReportKey(key);
    setFrom("");
    setTo("");
    return fetchReport(key, {});
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

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Reports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_REPORTS.map((item) =>
            item.kind === "link" ? (
              <Link key={item.label} to={item.to} className={quickReportClass}>{item.label}</Link>
            ) : (
              <button key={item.label} type="button" className={quickReportClass} onClick={() => quickRun(item.key)}>{item.label}</button>
            )
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">All Reports (Advanced)</h2>
        <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Report" value={reportKey} onChange={(e) => { setReportKey(e.target.value as ReportKey); setRows(null); }} className="w-56">
            {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
          <Input label={isSingleDate ? "Date" : "From"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          {!isSingleDate && <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />}
          <Button onClick={runReport} disabled={loading}>{loading ? "Loading…" : "Run Report"}</Button>
          {isList && rows.length > 0 && <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        </div>
        </Card>
      </div>

      {rows && !isList && (
        <Card>
          <h3 className="font-semibold text-gray-800 mb-3">{objectMeta?.title ?? "Summary"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(rows as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="border rounded-md p-3">
                <p className="text-xs text-gray-500 capitalize">{labelFor(k)}</p>
                <p className="font-semibold text-gray-900">
                  {k === "date" && typeof v === "string" ? formatDate(v) : typeof v === "number" ? formatMoney(v) : String(v)}
                </p>
              </div>
            ))}
          </div>
          {objectMeta?.note && <p className="text-xs text-gray-400 mt-3">{objectMeta.note}</p>}
        </Card>
      )}

      {isList && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  {columns.map((c) => <th key={c} className="py-1.5 pr-4 capitalize">{labelFor(c)}</th>)}
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
