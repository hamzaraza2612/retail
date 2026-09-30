import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NewSaleModal from "./NewSaleModal";
import { ordersApi, customersApi, productsApi, invoicesApi } from "../../api/endpoints";
import type { Customer, Product, SalesOrder, Invoice } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  customersApi: { list: vi.fn() },
  productsApi: { list: vi.fn() },
  ordersApi: { create: vi.fn(), updateStatus: vi.fn() },
  invoicesApi: { list: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const cashCustomer: Customer = {
  id: 1, customerCode: "CASH-001", businessName: "Walk-in / Cash Customer", phone: "N/A",
  customerType: "Individual", creditLimit: 0, openingBalance: 0, currentBalance: 0, isActive: true, createdAt: "2026-01-01",
};

const hotelCustomer: Customer = {
  id: 2, customerCode: "CUST-2026-00001", businessName: "Restaurant XYZ", phone: "0300-0000000",
  customerType: "Restaurant", creditLimit: 100000, openingBalance: 0, currentBalance: 5000, isActive: true, createdAt: "2026-01-01",
};

const boneless: Product = {
  id: 10, sku: "BC-001", name: "Boneless Chicken", categoryId: 1, categoryName: "Boneless", unit: "KG",
  purchasePrice: 550, salePrice: 700, minimumStock: 10, currentStock: 50, isActive: true,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", productType: "FinishedProduct",
};

const breast: Product = {
  id: 11, sku: "BR-001", name: "Chicken Breast", categoryId: 1, categoryName: "Breast", unit: "KG",
  purchasePrice: 500, salePrice: 600, minimumStock: 10, currentStock: 20, isActive: true,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", productType: "FinishedProduct",
};

function mockOrder(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 1, orderNumber: "SO-2026-00001", customerId: cashCustomer.id, customerName: cashCustomer.businessName,
    orderDate: "2026-01-01", subtotal: 0, discount: 0, deliveryCharges: 0, grandTotal: 0, paidAmount: 0,
    remainingAmount: 0, status: "Draft", paymentStatus: "Unpaid", createdAt: "2026-01-01", items: [], ...overrides,
  };
}

function mockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 100, invoiceNumber: "INV-2026-00001", salesOrderId: 1, orderNumber: "SO-2026-00001",
    customerId: cashCustomer.id, customerName: cashCustomer.businessName, invoiceDate: "2026-01-01",
    subtotal: 0, discount: 0, deliveryCharges: 0, grandTotal: 0, paidAmount: 0, balanceAmount: 0,
    paymentStatus: "Paid", items: [], ...overrides,
  };
}

function renderModal(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <NewSaleModal open onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>
  );
  return { onSaved, onClose };
}

async function selectProductRow(rowIndex: number, product: Product, quantity: number) {
  const productSelects = screen.getAllByLabelText("Product");
  await userEvent.selectOptions(productSelects[rowIndex], String(product.id));
  const qtyInputs = screen.getAllByLabelText("Quantity");
  await userEvent.clear(qtyInputs[rowIndex]);
  await userEvent.type(qtyInputs[rowIndex], String(quantity));
}

beforeEach(() => {
  vi.clearAllMocks();
  (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [cashCustomer, hotelCustomer], totalCount: 2 } });
  (productsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [boneless, breast], totalCount: 2 } });
});

describe("NewSaleModal — Cash Sale", () => {
  it("auto-selects the Walk-in/Cash Customer and defaults Cash Received to Net Total", async () => {
    renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);

    await selectProductRow(0, boneless, 5); // 5 * 700 = 3500

    await waitFor(() => {
      const receivedRow = screen.getByText("Cash Received").closest("div") as HTMLElement;
      expect(within(receivedRow).getByRole("spinbutton")).toHaveValue(3500);
    });
    expect(screen.getByText("Net Total").closest("div")).toHaveTextContent("Rs. 3,500");
  });

  it("saves a cash sale by creating and confirming the order, then shows the success screen", async () => {
    (ordersApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOrder({ id: 42 }) });
    (ordersApi.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockOrder({ id: 42, status: "Confirmed", subtotal: 3500, grandTotal: 3500, paidAmount: 3500, remainingAmount: 0 }),
    });
    (invoicesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [mockInvoice({ salesOrderId: 42 })], totalCount: 1 } });

    const { onSaved } = renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);
    await selectProductRow(0, boneless, 5);

    await userEvent.click(screen.getByRole("button", { name: "SAVE SALE" }));

    await screen.findByText("Invoice Number");
    expect(ordersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: cashCustomer.id, items: [{ productId: boneless.id, quantity: 5, rate: 700 }] })
    );
    expect(ordersApi.updateStatus).toHaveBeenCalledWith(42, "Confirmed");
    expect(screen.getByText("INV-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Customer").closest("div")).toHaveTextContent("Walk-in / Cash Customer");
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Print Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Sale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Customer" })).toBeInTheDocument();
  });
});

describe("NewSaleModal — Credit Sale", () => {
  it("requires selecting a named customer and shows Amount Due", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: "CREDIT SALE" }));

    expect(screen.getByLabelText("Customer")).toBeInTheDocument();
    expect(screen.queryByText(/Walk-in \/ Cash Customer/)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Customer"), String(hotelCustomer.id));
    await selectProductRow(0, boneless, 10); // 10 * 700 = 7000

    expect(screen.getByText("Amount Due").closest("div")).toHaveTextContent("Rs. 7,000");
  });

  it("saves a credit sale against the selected customer with the correct amount due", async () => {
    (ordersApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOrder({ id: 55, customerId: hotelCustomer.id }) });
    (ordersApi.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockOrder({
        id: 55, customerId: hotelCustomer.id, customerName: hotelCustomer.businessName, status: "Confirmed",
        subtotal: 7000, grandTotal: 7000, paidAmount: 0, remainingAmount: 7000,
      }),
    });
    (invoicesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { items: [mockInvoice({ id: 200, invoiceNumber: "INV-2026-00002", salesOrderId: 55, orderNumber: "SO-2026-00001", customerId: hotelCustomer.id })], totalCount: 1 },
    });

    renderModal();
    await userEvent.click(screen.getByRole("button", { name: "CREDIT SALE" }));
    await userEvent.selectOptions(screen.getByLabelText("Customer"), String(hotelCustomer.id));
    await selectProductRow(0, boneless, 10);

    await userEvent.click(screen.getByRole("button", { name: "SAVE SALE" }));

    await screen.findByText("Invoice Number");
    expect(ordersApi.create).toHaveBeenCalledWith(expect.objectContaining({ customerId: hotelCustomer.id }));
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("Rs. 7,000");
    expect(screen.getByText("Paid").closest("div")).toHaveTextContent("Rs. 0");
    expect(screen.getByText("Remaining").closest("div")).toHaveTextContent("Rs. 7,000");
  });
});

describe("NewSaleModal — multi-product sale", () => {
  it("adds multiple product lines and sums them into a single Net Total", async () => {
    renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);

    await selectProductRow(0, boneless, 5); // 3500
    await userEvent.click(screen.getByRole("button", { name: "+ Add product" }));
    await selectProductRow(1, breast, 2); // 1200

    expect(screen.getByText("Subtotal").closest("div")).toHaveTextContent("Rs. 4,700");
    expect(screen.getByText("Net Total").closest("div")).toHaveTextContent("Rs. 4,700");
    expect(screen.getAllByLabelText("Product")).toHaveLength(2);
  });

  it("submits every product line in the create request", async () => {
    (ordersApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOrder({ id: 7 }) });
    (ordersApi.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockOrder({ id: 7, status: "Confirmed", grandTotal: 4700, paidAmount: 4700 }),
    });
    (invoicesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [mockInvoice({ salesOrderId: 7 })], totalCount: 1 } });

    renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);
    await selectProductRow(0, boneless, 5);
    await userEvent.click(screen.getByRole("button", { name: "+ Add product" }));
    await selectProductRow(1, breast, 2);

    await userEvent.click(screen.getByRole("button", { name: "SAVE SALE" }));

    await screen.findByText("Invoice Number");
    expect(ordersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          { productId: boneless.id, quantity: 5, rate: 700 },
          { productId: breast.id, quantity: 2, rate: 600 },
        ],
      })
    );
  });
});

describe("NewSaleModal — insufficient stock", () => {
  it("shows the server's error, cancels the draft it created, and lets the user retry", async () => {
    (ordersApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOrder({ id: 99 }) });
    (ordersApi.updateStatus as ReturnType<typeof vi.fn>).mockImplementation((id: number, status: string) => {
      if (status === "Confirmed") {
        return Promise.reject({ response: { data: { error: "Insufficient stock for 'Boneless Chicken'. Available: 50.00 KG, requested: 999.000 KG." } } });
      }
      return Promise.resolve({ data: mockOrder({ id, status: "Cancelled" }) });
    });

    const toast = (await import("react-hot-toast")).default;
    renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);
    await selectProductRow(0, boneless, 999);

    await userEvent.click(screen.getByRole("button", { name: "SAVE SALE" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Insufficient stock"));
    });
    // The half-finished Draft is cleaned up automatically rather than left dangling.
    await waitFor(() => expect(ordersApi.updateStatus).toHaveBeenCalledWith(99, "Cancelled"));
    // The form stays open and usable so the user can fix the quantity and retry.
    expect(screen.getByRole("button", { name: "SAVE SALE" })).toBeEnabled();
    expect(screen.queryByText("Sale Saved")).not.toBeInTheDocument();
  });
});

describe("NewSaleModal — duplicate submit prevention", () => {
  it("only sends one create request when Save Sale is clicked twice quickly", async () => {
    let resolveCreate!: (v: { data: SalesOrder }) => void;
    (ordersApi.create as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    (ordersApi.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockOrder({ id: 1, status: "Confirmed" }) });
    (invoicesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [mockInvoice()], totalCount: 1 } });

    renderModal();
    await screen.findByText(/Walk-in \/ Cash Customer/);
    await selectProductRow(0, boneless, 5);

    const saveButton = screen.getByRole("button", { name: "SAVE SALE" });
    await userEvent.click(saveButton);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    // A second click while the first request is still in flight must be a no-op.
    await userEvent.click(screen.getByRole("button", { name: "Saving…" }));

    resolveCreate({ data: mockOrder({ id: 1 }) });
    await screen.findByText("Invoice Number");

    expect(ordersApi.create).toHaveBeenCalledTimes(1);
  });
});
