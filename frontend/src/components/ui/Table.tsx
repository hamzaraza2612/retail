import type { ReactNode } from "react";

interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyFn: (row: T) => string | number;
}

export default function Table<T>({ columns, rows, loading, emptyMessage = "No records found.", keyFn }: Props<T>) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((c, i) => (
              <th key={i} className={`text-left font-semibold text-gray-600 px-4 py-2.5 whitespace-nowrap ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-10 text-gray-400">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-10 text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={keyFn(row)} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                {columns.map((c, i) => (
                  <td key={i} className={`px-4 py-2.5 whitespace-nowrap ${c.className ?? ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
