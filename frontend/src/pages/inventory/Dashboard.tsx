import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "../../api/endpoints";
import type { Product } from "../../api/types";
import { Card } from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import { formatMoney } from "../../lib/format";

// The two things a business owner actually wants from a stock screen: what raw chicken is
// on hand, and what's ready to sell (with today's rate). Anything about how stock got to
// this number — movement history, manual adjustments — lives under Stock Adjustments &
// History (More / Administration) rather than cluttering this view. Every figure here still
// comes straight from Product.currentStock/minimumStock, the same fields and "low stock"
// definition (currentStock <= minimumStock) the rest of the app already uses — nothing new
// is computed or thresholded here.
export default function StockPage() {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    productsApi.list({ active: true, pageSize: 500 }).then((res) => setProducts(res.data.items));
  }, []);

  if (!products) return <p className="text-gray-400">Loading…</p>;

  const rawMaterials = products.filter((p) => p.productType === "RawMaterial");
  const finishedProducts = products.filter((p) => p.productType === "FinishedProduct");
  const isLowStock = (p: Product) => p.currentStock <= p.minimumStock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">What's on hand right now</p>
        </div>
        <Link to="/inventory/history" className="text-sm text-green-700 hover:underline inline-block py-1 -my-1">Stock Adjustments &amp; History &rarr;</Link>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Raw Material</h3>
        <Table
          keyFn={(p) => p.id}
          rows={rawMaterials}
          emptyMessage="No raw material products yet."
          columns={[
            { header: "Product", render: (p) => p.name },
            {
              header: "Stock",
              render: (p) => (
                <span className={isLowStock(p) ? "text-red-600 font-medium" : "font-medium"}>
                  {p.currentStock}{isLowStock(p) && <span className="ml-2 text-xs font-normal">(Low Stock)</span>}
                </span>
              ),
            },
            { header: "Unit", render: (p) => p.unit },
          ]}
        />
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-800 mb-3">Finished Products</h3>
        <Table
          keyFn={(p) => p.id}
          rows={finishedProducts}
          emptyMessage="No finished products yet."
          columns={[
            { header: "Product", render: (p) => p.name },
            {
              header: "Stock KG",
              render: (p) => (
                <span className={isLowStock(p) ? "text-red-600 font-medium" : "font-medium"}>
                  {p.currentStock} {p.unit}{isLowStock(p) && <span className="ml-2 text-xs font-normal">(Low Stock)</span>}
                </span>
              ),
            },
            { header: "Current Sale Rate", render: (p) => `${formatMoney(p.salePrice)}/${p.unit}` },
          ]}
        />
      </Card>
    </div>
  );
}
