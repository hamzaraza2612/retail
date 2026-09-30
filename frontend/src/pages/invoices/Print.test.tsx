import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InvoicePrintPage from "./Print";
import { invoicesApi, ordersApi } from "../../api/endpoints";
import type { Invoice, SalesOrder } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  invoicesApi: { get: vi.fn() },
  ordersApi: { get: vi.fn() },
}));

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1, invoiceNumber: "INV-2026-00001", salesOrderId: 5, orderNumber: "SO-2026-00005",
    customerId: 9, customerName: "Hotel Grand", customerPhone: "0300-1234567", customerAddress: "Main Blvd, Lahore",
    invoiceDate: "2026-09-30T00:00:00Z", subtotal: 7000, discount: 200, deliveryCharges: 0,
    grandTotal: 6800, paidAmount: 6800, balanceAmount: 0, paymentStatus: "Paid",
    items: [{ id: 1, productId: 10, productName: "Boneless Chicken", quantity: 10, unit: "KG", rate: 700, total: 7000 }],
    ...overrides,
  };
}

function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 5, orderNumber: "SO-2026-00005", customerId: 9, customerName: "Hotel Grand", orderDate: "2026-09-30T00:00:00Z",
    subtotal: 7000, discount: 200, deliveryCharges: 0, grandTotal: 6800, paidAmount: 6800, remainingAmount: 0,
    status: "Confirmed", paymentStatus: "Paid", createdAt: "2026-09-30T00:00:00Z",
    items: [{ id: 1, productId: 10, productName: "Boneless Chicken", quantity: 10, unit: "KG", rate: 700, total: 7000 }],
    ...overrides,
  };
}

function renderPrint() {
  return render(
    <MemoryRouter initialEntries={["/invoices/1/print"]}>
      <Routes><Route path="/invoices/:id/print" element={<InvoicePrintPage />} /></Routes>
    </MemoryRouter>
  );
}

describe("InvoicePrintPage", () => {
  beforeEach(() => {
    vi.mocked(invoicesApi.get).mockReset();
    vi.mocked(ordersApi.get).mockReset();
  });

  it("shows every required field with business terminology and no internal IDs", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({ data: invoice() } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order() } as any);

    renderPrint();

    expect(await screen.findByText("Chicken Wholesale & Supply")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Hotel Grand")).toBeInTheDocument();
    expect(screen.getByText("Boneless Chicken")).toBeInTheDocument();
    expect(screen.getByText("Quantity")).toBeInTheDocument();
    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Discount")).toBeInTheDocument();
    expect(screen.getByText("Net Total")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Balance Due")).toBeInTheDocument();

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/\b(id|Id)[:=]\s*\d/);
    expect(bodyText).not.toContain("customerId");
    expect(bodyText).not.toContain("salesOrderId");
  });

  it("cash invoice: renders cleanly for the walk-in cash customer without a placeholder phone number", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({
      data: invoice({ customerName: "Walk-in / Cash Customer", customerPhone: "N/A", customerAddress: undefined, discount: 0, subtotal: 1000, grandTotal: 1000, paidAmount: 1000, balanceAmount: 0, paymentStatus: "Paid" }),
    } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Confirmed" }) } as any);

    renderPrint();

    expect(await screen.findByText("Walk-in / Cash Customer")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
    expect(screen.getByText("Paid in Full")).toBeInTheDocument();
  });

  it("credit invoice: shows a hotel/restaurant/shop customer's outstanding balance in red", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({
      data: invoice({ customerName: "Al-Madina Restaurant", grandTotal: 6800, paidAmount: 0, balanceAmount: 6800, paymentStatus: "Unpaid" }),
    } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Confirmed" }) } as any);

    renderPrint();

    await screen.findByText("Al-Madina Restaurant");
    expect(screen.getByText("Unpaid")).toBeInTheDocument();
    const balanceRow = screen.getByText("Balance Due").parentElement!;
    expect(balanceRow).toHaveClass("text-red-600");
  });

  it("partially paid invoice: shows a positive balance due", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({
      data: invoice({ grandTotal: 6800, paidAmount: 3000, balanceAmount: 3800, paymentStatus: "Partial" }),
    } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Confirmed" }) } as any);

    renderPrint();

    await screen.findByText("Partially Paid");
    const balanceRow = screen.getByText("Balance Due").parentElement!;
    expect(balanceRow).toHaveClass("text-red-600");
    expect(balanceRow.textContent).toContain("3,800");
  });

  it("fully paid invoice: shows zero balance due without alarming red styling", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({
      data: invoice({ grandTotal: 6800, paidAmount: 6800, balanceAmount: 0, paymentStatus: "Paid" }),
    } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Confirmed" }) } as any);

    renderPrint();

    await screen.findByText("Paid in Full");
    const balanceRow = screen.getByText("Balance Due").parentElement!;
    expect(balanceRow).toHaveClass("text-green-700");
  });

  it("cancelled invoice: shows a clear Cancelled banner explaining the zeroed amounts", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({
      data: invoice({ subtotal: 0, discount: 0, grandTotal: 0, paidAmount: 0, balanceAmount: 0, paymentStatus: "Paid" }),
    } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Cancelled" }) } as any);

    renderPrint();

    expect(await screen.findByText(/Cancelled — this order was cancelled/i)).toBeInTheDocument();
  });

  it("does not show a Cancelled banner for a normal (non-cancelled) order", async () => {
    vi.mocked(invoicesApi.get).mockResolvedValue({ data: invoice() } as any);
    vi.mocked(ordersApi.get).mockResolvedValue({ data: order({ status: "Confirmed" }) } as any);

    renderPrint();

    await screen.findByText("INV-2026-00001");
    expect(screen.queryByText(/Cancelled —/i)).not.toBeInTheDocument();
  });
});
