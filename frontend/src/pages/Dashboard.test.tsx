import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { dashboardApi, productsApi } from "../api/endpoints";

vi.mock("../api/endpoints", () => ({
  dashboardApi: { get: vi.fn() },
  productsApi: { list: vi.fn() },
}));

let currentRole = "Admin";
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(currentRole) }),
}));

vi.mock("./orders/NewSaleModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>NewSaleModal Open</div> : null),
}));
vi.mock("./purchases/NewPurchaseModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>NewPurchaseModal Open</div> : null),
}));
vi.mock("./processing/ChickenCuttingModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>ChickenCuttingModal Open</div> : null),
}));
vi.mock("./customers/ReceivePaymentModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>ReceivePaymentModal Open</div> : null),
}));

function cards(overrides: Record<string, number> = {}) {
  return {
    todaySales: 85000, todayOrders: 12, todayPurchases: 40000, todayExpenses: 3000,
    totalReceivables: 62000, totalPayables: 20000, stockValue: 500000, estimatedGrossProfitThisMonth: 300000,
    todayCashSales: 30000, todayCreditSales: 55000,
    todayEstimatedGrossProfit: 18000, todayOperatingProfitLoss: 15000,
    todayProcessingBatches: 2, todayRawMaterialProcessed: 500, todayProducedQuantity: 480,
    rawStockValue: 100000, finishedStockValue: 200000,
    ...overrides,
  };
}

function product(overrides: Partial<{ id: number; name: string; productType: string; currentStock: number; unit: string }>) {
  return {
    id: 1, sku: "SKU", name: "Product", categoryId: 1, categoryName: "Cat", unit: "KG",
    purchasePrice: 500, salePrice: 600, minimumStock: 10, currentStock: 0,
    isActive: true, createdAt: "", updatedAt: "", productType: "FinishedProduct",
    ...overrides,
  };
}

function renderDashboard() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

describe("Dashboard (Today's Business)", () => {
  beforeEach(() => {
    currentRole = "Admin";
    vi.mocked(dashboardApi.get).mockReset();
    vi.mocked(productsApi.list).mockReset();
  });

  it("shows the ten required business figures", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({
      data: {
        items: [
          product({ id: 1, name: "Raw Chicken (Whole Bird)", productType: "RawMaterial", currentStock: 982 }),
          product({ id: 2, name: "Boneless Chicken", productType: "FinishedProduct", currentStock: 275 }),
        ],
        totalCount: 2,
      },
    } as any);

    renderDashboard();

    expect(await screen.findByText("Today's Business")).toBeInTheDocument();
    for (const label of [
      "Today's Sales", "Cash Received", "Credit Sales", "Customer Outstanding",
      "Raw Chicken Stock", "Finished Product Stock", "Today's Processing",
      "Today's Expenses", "Estimated Gross Profit", "Estimated Operating Result",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText("Rs. 85,000")).toBeInTheDocument();
    expect(screen.getByText("Rs. 30,000")).toBeInTheDocument();
    expect(screen.getByText("Rs. 55,000")).toBeInTheDocument();
    expect(screen.getByText("Rs. 62,000")).toBeInTheDocument();
    expect(screen.getByText("982 KG")).toBeInTheDocument();
    expect(screen.getByText("275 KG")).toBeInTheDocument();
    expect(screen.getByText("480 KG")).toBeInTheDocument();
    expect(screen.getByText("2 cutting batch(es) completed")).toBeInTheDocument();
    expect(screen.getByText("Rs. 18,000")).toBeInTheDocument();
    expect(screen.getByText("Rs. 15,000")).toBeInTheDocument();
  });

  it("labels both profit figures as Estimated, since costing is weight-based", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();

    await screen.findByText("Estimated Gross Profit");
    expect(screen.getByText("Estimated — costing is weight-based")).toBeInTheDocument();
    expect(screen.getByText("Estimated Profit after expenses")).toBeInTheDocument();
  });

  it("shows the operating result in red when it's a loss", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards({ todayOperatingProfitLoss: -5000 }) } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();

    const value = await screen.findByText("Rs. -5,000");
    expect(value).toHaveClass("text-red-600");
  });

  it("opens the New Sale quick action as a one-click modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "New Sale" }));

    expect(await screen.findByText("NewSaleModal Open")).toBeInTheDocument();
  });

  it("opens the Cutting quick action as a one-click modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();
    await user.click(await screen.findByRole("button", { name: "Cutting" }));

    expect(await screen.findByText("ChickenCuttingModal Open")).toBeInTheDocument();
  });

  it("links Add Expense and Customer Ledger to their existing pages rather than duplicating them", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();

    expect(await screen.findByRole("link", { name: "Add Expense" })).toHaveAttribute("href", "/expenses");
    expect(screen.getByRole("link", { name: "Customer Ledger" })).toHaveAttribute("href", "/customers");
  });

  it("hides quick actions the current role isn't authorized for", async () => {
    currentRole = "Delivery";
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();

    await screen.findByText("Today's Business");
    expect(screen.queryByRole("button", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Purchase" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cutting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive Payment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Expense" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Customer Ledger" })).not.toBeInTheDocument();
  });

  it("does not show removed technical/analytical widgets from the old dashboard", async () => {
    vi.mocked(dashboardApi.get).mockResolvedValue({ data: { cards: cards() } } as any);
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [], totalCount: 0 } } as any);

    renderDashboard();

    await screen.findByText("Today's Business");
    expect(screen.queryByText("Sales — Last 7 Days")).not.toBeInTheDocument();
    expect(screen.queryByText("Top Selling Products")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Low Stock Alerts")).not.toBeInTheDocument();
  });
});
