import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CustomerDetailPage from "./Detail";
import { customersApi, productsApi, paymentsApi, invoicesApi } from "../../api/endpoints";
import type { Customer, CustomerDetail, Product } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  customersApi: { get: vi.fn(), statement: vi.fn(), list: vi.fn() },
  productsApi: { list: vi.fn() },
  ordersApi: { create: vi.fn(), updateStatus: vi.fn() },
  invoicesApi: { list: vi.fn() },
  paymentsApi: { create: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

let currentRole = "Admin";
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(currentRole) }),
}));

const hotelCustomer: Customer = {
  id: 1, customerCode: "CUST-2026-00001", businessName: "Restaurant XYZ", phone: "0300-0000000",
  customerType: "Restaurant", creditLimit: 100000, openingBalance: 0, currentBalance: 8000, isActive: true, createdAt: "2026-01-01",
};

const boneless: Product = {
  id: 10, sku: "BC-001", name: "Boneless Chicken", categoryId: 1, categoryName: "Boneless", unit: "KG",
  purchasePrice: 550, salePrice: 700, minimumStock: 10, currentStock: 50, isActive: true,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", productType: "FinishedProduct",
};

function detail(overrides: Partial<CustomerDetail> = {}, customer: Customer = hotelCustomer): CustomerDetail {
  return { customer, totalPurchases: 42000, totalPaid: 34000, lastOrderDate: "2026-09-15", totalOrders: 6, ...overrides };
}

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/customers/1"]}>
      <Routes><Route path="/customers/:id" element={<CustomerDetailPage />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  currentRole = "Admin";
  vi.clearAllMocks();
  (productsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [boneless], totalCount: 1 } });
  (invoicesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [], totalCount: 0 } });
});

describe("CustomerDetailPage — existing customer", () => {
  it("shows Total Sales, Total Paid, Amount Due and Last Sale", async () => {
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail() });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { openingBalance: 0, closingBalance: 8000, rows: [] } });

    renderDetail();
    await screen.findByText("Restaurant XYZ");

    expect(screen.getByText("Total Sales").closest("div")).toHaveTextContent("Rs. 42,000");
    expect(screen.getByText("Total Paid").closest("div")).toHaveTextContent("Rs. 34,000");
    expect(screen.getByText("Amount Due").closest("div")).toHaveTextContent("Rs. 8,000");
    expect(screen.getByText("Last Sale").closest("div")).toHaveTextContent("6 sales total");
  });
});

describe("CustomerDetailPage — customer with credit", () => {
  it("reflects a credit sale as Credit Sales in the ledger summary and Sale in recent transactions", async () => {
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail() });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { openingBalance: 3000, closingBalance: 8000, rows: [{ type: "Invoice", date: "2026-09-10", reference: "INV-2026-00001", debit: 5000, credit: 0, balance: 8000 }] },
    });

    renderDetail();
    await screen.findByText("Restaurant XYZ");

    expect(screen.getByText("Opening Due").closest("div")).toHaveTextContent("Rs. 3,000");
    expect(screen.getByText("+ Credit Sales").closest("div")).toHaveTextContent("Rs. 5,000");
    expect(screen.getByText("Sale")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-00001", { exact: false })).toBeInTheDocument();
  });
});

describe("CustomerDetailPage — customer with payment", () => {
  it("reflects a payment as Payments Received in the ledger summary and Payment in recent transactions", async () => {
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail() });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { openingBalance: 11000, closingBalance: 8000, rows: [{ type: "Payment", date: "2026-09-12", reference: "PAY-2026-00001", debit: 0, credit: 3000, balance: 8000 }] },
    });

    renderDetail();
    await screen.findByText("Restaurant XYZ");

    expect(screen.getByText(/Payments Received/).closest("div")).toHaveTextContent("Rs. 3,000");
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("− Rs. 3,000")).toBeInTheDocument();
  });
});

describe("CustomerDetailPage — zero outstanding", () => {
  it("shows Rs. 0 with no overdue styling", async () => {
    const zeroCustomer = { ...hotelCustomer, currentBalance: 0 };
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail({}, zeroCustomer) });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { openingBalance: 0, closingBalance: 0, rows: [] } });

    renderDetail();
    await screen.findByText("Restaurant XYZ");

    const outstandingBlock = screen.getByText("Amount Due").closest("div") as HTMLElement;
    expect(within(outstandingBlock).getByText("Rs. 0").className).not.toContain("text-red-600");
    const currentDueBlock = screen.getByText("Current Due").closest("div") as HTMLElement;
    expect(within(currentDueBlock).getByText("Rs. 0").className).not.toContain("text-red-600");
  });
});

describe("CustomerDetailPage — outstanding balance", () => {
  it("highlights a non-zero balance on both the stat card and Current Due", async () => {
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail() });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { openingBalance: 0, closingBalance: 8000, rows: [] } });

    renderDetail();
    await screen.findByText("Restaurant XYZ");

    const outstandingBlock = screen.getByText("Amount Due").closest("div") as HTMLElement;
    expect(within(outstandingBlock).getByText("Rs. 8,000").className).toContain("text-red-600");
    const currentDueBlock = screen.getByText("Current Due").closest("div") as HTMLElement;
    expect(within(currentDueBlock).getByText("Rs. 8,000").className).toContain("text-red-600");
  });
});

describe("CustomerDetailPage — navigation shortcuts", () => {
  beforeEach(() => {
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: detail() });
    (customersApi.statement as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { openingBalance: 0, closingBalance: 8000, rows: [] } });
    // NewSaleModal fetches its own customer list once opened (it's a general-purpose
    // component, not customer-scoped) — provide it here so the Credit Sale dropdown has
    // something to render.
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [hotelCustomer], totalCount: 1 } });
  });

  it("Customer -> New Sale opens the sale modal pre-set to Credit Sale for this customer", async () => {
    renderDetail();
    await screen.findByText("Restaurant XYZ");

    await userEvent.click(screen.getByRole("button", { name: "New Sale" }));

    expect(await screen.findByRole("heading", { name: "New Sale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CREDIT SALE" })).toHaveClass("bg-green-600");
    expect(screen.getByLabelText("Customer")).toHaveValue(String(hotelCustomer.id));
  });

  it("Customer -> Receive Payment records a payment against this customer", async () => {
    (paymentsApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: 1, paymentNumber: "PAY-2026-00001", customerId: hotelCustomer.id, customerName: hotelCustomer.businessName, amount: 8000 },
    });
    renderDetail();
    await screen.findByText("Restaurant XYZ");

    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));
    await screen.findByRole("heading", { name: "Receive Payment" });
    expect(screen.getByText("Restaurant XYZ", { selector: "span" })).toBeInTheDocument();

    // Two elements now share the name "Receive Payment": the trigger button behind the
    // modal, and the modal's own submit button — the submit button is the one rendered
    // last in the DOM.
    const receivePaymentButtons = screen.getAllByRole("button", { name: "Receive Payment" });
    await userEvent.click(receivePaymentButtons[receivePaymentButtons.length - 1]);

    await waitFor(() => {
      expect(paymentsApi.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: hotelCustomer.id, amount: 8000 }));
    });
    await screen.findByText("Remaining Due");
    // customersApi.get is called 3 times in total: the page's initial load, the modal's own
    // refresh of the authoritative balance for its success screen, and the page reloading
    // itself again via onSaved.
    expect(customersApi.get).toHaveBeenCalledTimes(3);
  });

  it("hides New Sale and Receive Payment for a role that cannot perform them", async () => {
    currentRole = "Delivery";
    renderDetail();
    await screen.findByText("Restaurant XYZ");

    expect(screen.queryByRole("button", { name: "New Sale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive Payment" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Ledger" })).toBeInTheDocument();
  });
});
