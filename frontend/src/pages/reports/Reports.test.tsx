import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportsPage from "./Reports";
import { reportsApi } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  reportsApi: {
    dailySales: vi.fn(), purchases: vi.fn(), receivables: vi.fn(), expenses: vi.fn(),
    productProfit: vi.fn(), yield: vi.fn(), cashVsCredit: vi.fn(), profitSummary: vi.fn(),
    dailyProfit: vi.fn(), payables: vi.fn(), inventory: vi.fn(),
  },
}));

function renderPage() {
  return render(<MemoryRouter><ReportsPage /></MemoryRouter>);
}

describe("ReportsPage (prioritized landing page)", () => {
  beforeEach(() => {
    Object.values(reportsApi).forEach((fn) => vi.mocked(fn as any).mockReset());
  });

  it("shows the nine quick reports in the required priority order", () => {
    renderPage();
    const quickReportsHeading = screen.getByText("Quick Reports");
    const container = quickReportsHeading.parentElement!;
    const tiles = Array.from(container.querySelectorAll("button, a")).map((el) => el.textContent);

    expect(tiles).toEqual([
      "Today's Business", "Stock", "Customer Outstanding", "Product Profit", "Processing/Yield",
      "Cash vs Credit", "Sales", "Purchases", "Expenses",
    ]);
  });

  it("links Today's Business and Stock to their own pages instead of running a report", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Today's Business" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Stock" })).toHaveAttribute("href", "/inventory");
  });

  it("running the Customer Outstanding quick report calls the receivables report and shows results immediately", async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.receivables).mockResolvedValue({
      data: [{ customerCode: "CUST-1", businessName: "Hotel X", phone: "0300", creditLimit: 100000, outstandingBalance: 5000 }],
    } as any);

    renderPage();
    await user.click(screen.getByRole("button", { name: "Customer Outstanding" }));

    await waitFor(() => expect(reportsApi.receivables).toHaveBeenCalled());
    expect(await screen.findByText("Hotel X")).toBeInTheDocument();
  });

  it("keeps the full advanced report tool (all report types, date range, export) accessible", () => {
    renderPage();
    expect(screen.getByText("All Reports (Advanced)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Report" })).toBeInTheDocument();
    expect(screen.getByText("Report")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("labels profit figures as Estimated in object-style report summaries", async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.cashVsCredit).mockResolvedValue({
      data: { cashSales: 1000, cashOrderCount: 1, creditSales: 2000, creditOrderCount: 2, totalSales: 3000 },
    } as any);

    renderPage();
    await user.click(screen.getByRole("button", { name: "Cash vs Credit" }));
    await waitFor(() => expect(reportsApi.cashVsCredit).toHaveBeenCalled());
    await screen.findByRole("heading", { name: "Cash vs Credit Sales" });

    // No raw, un-qualified "profit" figure should render for report types that carry one —
    // spot-check via the Product Profit quick report instead, which does carry one.
    vi.mocked(reportsApi.productProfit).mockResolvedValue({
      data: [{ productName: "Boneless", soldQuantity: 10, averageRate: 700, revenue: 7000, estimatedCost: 5000, grossProfit: 2000 }],
    } as any);
    await user.click(screen.getByRole("button", { name: "Product Profit" }));
    await waitFor(() => expect(reportsApi.productProfit).toHaveBeenCalled());

    expect(await screen.findByText("Estimated Gross Profit")).toBeInTheDocument();
    expect(screen.getByText("Estimated Cost")).toBeInTheDocument();
    expect(screen.queryByText(/^Gross Profit$/)).not.toBeInTheDocument();
  });
});
