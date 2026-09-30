import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StockPage from "./Dashboard";
import { productsApi } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  productsApi: { list: vi.fn() },
}));

function product(overrides: Partial<{
  id: number; name: string; unit: string; currentStock: number; minimumStock: number;
  salePrice: number; productType: string;
}>) {
  return {
    id: 1, sku: "SKU-1", name: "Product", categoryId: 1, categoryName: "Cat",
    unit: "KG", purchasePrice: 500, salePrice: 600, minimumStock: 50, currentStock: 100,
    isActive: true, createdAt: "", updatedAt: "", productType: "FinishedProduct",
    ...overrides,
  };
}

describe("StockPage (simplified Stock view)", () => {
  beforeEach(() => {
    vi.mocked(productsApi.list).mockReset();
  });

  it("shows Raw Material and Finished Products sections with the exact required columns", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({
      data: {
        items: [
          product({ id: 1, name: "Raw Chicken (Whole Bird)", productType: "RawMaterial", currentStock: 982, minimumStock: 200, unit: "KG" }),
          product({ id: 2, name: "Boneless Chicken", productType: "FinishedProduct", currentStock: 275, minimumStock: 60, salePrice: 1050, unit: "KG" }),
        ],
        totalCount: 2,
      },
    } as any);

    render(<MemoryRouter><StockPage /></MemoryRouter>);

    expect(await screen.findByText("Raw Material")).toBeInTheDocument();
    expect(screen.getByText("Finished Products")).toBeInTheDocument();
    expect(screen.getAllByText("Product")).toHaveLength(2);
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Stock KG")).toBeInTheDocument();
    expect(screen.getByText("Current Sale Rate")).toBeInTheDocument();

    expect(screen.getByText("Raw Chicken (Whole Bird)")).toBeInTheDocument();
    expect(screen.getByText("982")).toBeInTheDocument();

    expect(screen.getByText("Boneless Chicken")).toBeInTheDocument();
    expect(screen.getByText("275 KG")).toBeInTheDocument();
    expect(screen.getByText("Rs. 1,050/KG")).toBeInTheDocument();
  });

  it("flags a product as Low Stock only when currentStock <= minimumStock, using the product's own threshold", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({
      data: {
        items: [
          product({ id: 1, name: "Low Item", productType: "FinishedProduct", currentStock: 10, minimumStock: 50 }),
          product({ id: 2, name: "Healthy Item", productType: "FinishedProduct", currentStock: 500, minimumStock: 50 }),
        ],
        totalCount: 2,
      },
    } as any);

    render(<MemoryRouter><StockPage /></MemoryRouter>);

    await screen.findByText("Low Item");
    expect(screen.getAllByText("(Low Stock)")).toHaveLength(1);
    expect(screen.queryByText("500 KG")?.parentElement?.textContent).not.toContain("Low Stock");
  });

  it("links to the advanced Stock Adjustments & History page rather than showing movement details inline", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);
    render(<MemoryRouter><StockPage /></MemoryRouter>);

    const link = await screen.findByRole("link", { name: /Stock Adjustments & History/i });
    expect(link).toHaveAttribute("href", "/inventory/history");
    expect(screen.queryByText("Recent Stock Movements")).not.toBeInTheDocument();
    expect(screen.queryByText("Adjust Stock")).not.toBeInTheDocument();
  });

  it("shows empty-state messages when there is no stock of a given type yet", async () => {
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);
    render(<MemoryRouter><StockPage /></MemoryRouter>);

    expect(await screen.findByText("No raw material products yet.")).toBeInTheDocument();
    expect(screen.getByText("No finished products yet.")).toBeInTheDocument();
  });
});
