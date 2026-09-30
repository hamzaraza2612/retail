import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NewPurchaseModal from "./NewPurchaseModal";
import { purchasesApi, suppliersApi, productsApi } from "../../api/endpoints";
import type { Supplier, Product, Purchase } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  purchasesApi: { create: vi.fn() },
  suppliersApi: { list: vi.fn(), get: vi.fn() },
  productsApi: { list: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const supplier: Supplier = {
  id: 1, supplierCode: "SUP-2026-00001", name: "Ahmed Live Chicken Supplier", phone: "0300-1111111",
  supplierType: "LiveChicken", openingBalance: 0, currentBalance: 5000, isActive: true, createdAt: "2026-01-01",
};

const rawChicken: Product = {
  id: 10, sku: "RM-001", name: "Raw Chicken (Whole Bird)", categoryId: 1, categoryName: "Raw", unit: "KG",
  purchasePrice: 550, salePrice: 0, minimumStock: 50, currentStock: 200, isActive: true,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", productType: "RawMaterial",
};

const packaging: Product = {
  id: 20, sku: "PK-001", name: "Packaging Bags", categoryId: 2, categoryName: "Packaging", unit: "Piece",
  purchasePrice: 5, salePrice: 0, minimumStock: 100, currentStock: 500, isActive: true,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", productType: "FinishedProduct",
};

function mockPurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 1, purchaseNumber: "PO-2026-00001", supplierId: supplier.id, supplierName: supplier.name,
    purchaseDate: "2026-09-19", subtotal: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0,
    status: "Confirmed", createdAt: "2026-09-19", items: [], ...overrides,
  };
}

function renderModal(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <NewPurchaseModal open onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>
  );
  return { onSaved, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  (suppliersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [supplier], totalCount: 1 } });
  (productsApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [rawChicken, packaging], totalCount: 2 } });
});

describe("NewPurchaseModal — raw chicken is the easy default", () => {
  it("defaults straight to the raw material product with its catalog rate pre-filled", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id));
      expect(screen.getByLabelText("Purchase Rate")).toHaveValue(550);
    });
  });
});

describe("NewPurchaseModal — primary fields", () => {
  it("computes Total live from Quantity x Purchase Rate", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));

    await userEvent.type(screen.getByLabelText("Quantity"), "500");

    expect(screen.getByText("Total").closest("div")).toHaveTextContent("Rs. 275,000");
  });

  it("saves a single-product purchase with the chosen supplier, date and payment status", async () => {
    (purchasesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockPurchase({ totalAmount: 275000, paidAmount: 275000, remainingAmount: 0 }),
    });
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ...supplier, currentBalance: 5000 } });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "500");
    await userEvent.selectOptions(screen.getByLabelText("Payment Status"), "Paid");

    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    await screen.findByRole("button", { name: "New Purchase" });
    expect(purchasesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: supplier.id,
        items: [{ productId: rawChicken.id, quantity: 500, rate: 550 }],
        paidAmount: 275000,
      })
    );
  });
});

describe("NewPurchaseModal — Payment Status", () => {
  it("Unpaid records nothing paid", async () => {
    (purchasesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockPurchase() });
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: supplier });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "100");

    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    await screen.findByRole("button", { name: "New Purchase" });
    expect(purchasesApi.create).toHaveBeenCalledWith(expect.objectContaining({ paidAmount: 0 }));
  });

  it("Partially Paid requires and sends the entered amount", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "100");
    await userEvent.selectOptions(screen.getByLabelText("Payment Status"), "Partial");

    // No amount entered yet -> rejected before ever reaching the backend.
    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Amount paid must be between"));
    expect(purchasesApi.create).not.toHaveBeenCalled();

    (purchasesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockPurchase({ totalAmount: 55000, paidAmount: 20000, remainingAmount: 35000 }) });
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: supplier });
    await userEvent.type(screen.getByLabelText("Amount Paid"), "20000");
    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    await screen.findByRole("button", { name: "New Purchase" });
    expect(purchasesApi.create).toHaveBeenCalledWith(expect.objectContaining({ paidAmount: 20000 }));
  });
});

describe("NewPurchaseModal — after save", () => {
  it("shows Purchase Saved with the product added, Total and Supplier Balance, plus New Purchase / View Supplier", async () => {
    (purchasesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockPurchase({ totalAmount: 275000, paidAmount: 0, remainingAmount: 275000 }),
    });
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ...supplier, currentBalance: 280000 } });

    const { onSaved } = renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "500");

    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    await screen.findByRole("button", { name: "New Purchase" });
    expect(screen.getByText("Raw Chicken (Whole Bird) Added")).toBeInTheDocument();
    expect(screen.getByText("500 KG")).toBeInTheDocument();
    expect(screen.getByText("Total").closest("div")).toHaveTextContent("Rs. 275,000");
    expect(screen.getByText("Supplier Balance").closest("div")).toHaveTextContent("Rs. 280,000");
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "New Purchase" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Supplier" })).toBeInTheDocument();

    // Nothing about the underlying inventory transaction/ledger mechanics is shown.
    expect(screen.queryByText(/InventoryTransaction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PROCESSING_/)).not.toBeInTheDocument();
  });

  it("New Purchase resets the form for another entry", async () => {
    (purchasesApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockPurchase({ totalAmount: 275000 }) });
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: supplier });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await screen.findByRole("button", { name: "New Purchase" });

    await userEvent.click(screen.getByRole("button", { name: "New Purchase" }));

    expect(await screen.findByRole("button", { name: "Save Purchase" })).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toHaveValue(null);
  });
});

describe("NewPurchaseModal — validation and duplicate submission", () => {
  it("rejects submission with no supplier selected", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.type(screen.getByLabelText("Quantity"), "100");

    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    expect(toast.error).toHaveBeenCalledWith("Please select a supplier.");
    expect(purchasesApi.create).not.toHaveBeenCalled();
  });

  it("rejects a zero quantity", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));

    await userEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    expect(toast.error).toHaveBeenCalledWith("Quantity must be greater than zero.");
    expect(purchasesApi.create).not.toHaveBeenCalled();
  });

  it("prevents a duplicate submission while the first request is in flight", async () => {
    let resolveCreate!: (v: { data: Purchase }) => void;
    (purchasesApi.create as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    (suppliersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: supplier });

    renderModal();
    await waitFor(() => expect(screen.getByLabelText("Product")).toHaveValue(String(rawChicken.id)));
    await userEvent.selectOptions(screen.getByLabelText("Supplier"), String(supplier.id));
    await userEvent.type(screen.getByLabelText("Quantity"), "500");

    const submit = screen.getByRole("button", { name: "Save Purchase" });
    await userEvent.click(submit);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Saving…" }));
    resolveCreate({ data: mockPurchase({ totalAmount: 275000 }) });

    await screen.findByRole("button", { name: "New Purchase" });
    expect(purchasesApi.create).toHaveBeenCalledTimes(1);
  });
});
