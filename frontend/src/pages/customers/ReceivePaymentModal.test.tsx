import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReceivePaymentModal from "./ReceivePaymentModal";
import { paymentsApi, customersApi } from "../../api/endpoints";
import type { Customer } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  paymentsApi: { create: vi.fn() },
  customersApi: { list: vi.fn(), get: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const cashCustomer: Customer = {
  id: 1, customerCode: "CASH-001", businessName: "Walk-in / Cash Customer", phone: "N/A",
  customerType: "Individual", creditLimit: 0, openingBalance: 0, currentBalance: 0, isActive: true, createdAt: "2026-01-01",
};

const hotelCustomer: Customer = {
  id: 2, customerCode: "CUST-2026-00001", businessName: "Restaurant XYZ", phone: "0300-0000000",
  customerType: "Restaurant", creditLimit: 100000, openingBalance: 0, currentBalance: 10000, isActive: true, createdAt: "2026-01-01",
};

function renderPicker(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <ReceivePaymentModal open onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>
  );
  return { onSaved, onClose };
}

function renderFixed(onSaved = vi.fn()) {
  render(
    <MemoryRouter>
      <ReceivePaymentModal open onClose={vi.fn()} onSaved={onSaved} customerId={hotelCustomer.id} customerName={hotelCustomer.businessName} currentBalance={hotelCustomer.currentBalance} />
    </MemoryRouter>
  );
  return { onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [cashCustomer, hotelCustomer], totalCount: 2 } });
});

describe("ReceivePaymentModal — customer picker", () => {
  it("excludes the Walk-in/Cash Customer and shows Current Due once a customer is picked", async () => {
    renderPicker();
    await screen.findByLabelText("Customer");

    expect(screen.queryByText("Walk-in / Cash Customer")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Customer"), String(hotelCustomer.id));

    await waitFor(() => {
      expect(screen.getByText("Current Due").closest("div")).toHaveTextContent("Rs. 10,000");
      expect(screen.getByLabelText("Payment Amount")).toHaveValue(10000); // defaults to full outstanding
    });
  });
});

describe("ReceivePaymentModal — live preview", () => {
  it("shows Due Before, Payment and Due After as the amount changes", async () => {
    renderFixed();
    await screen.findByText("Restaurant XYZ");

    await userEvent.clear(screen.getByLabelText("Payment Amount"));
    await userEvent.type(screen.getByLabelText("Payment Amount"), "4000");

    expect(screen.getByText("Due Before").closest("div")).toHaveTextContent("Rs. 10,000");
    expect(screen.getByText("Payment").closest("div")).toHaveTextContent("Rs. 4,000");
    expect(screen.getByText("Due After").closest("div")).toHaveTextContent("Rs. 6,000");
  });
});

describe("ReceivePaymentModal — prevents invalid payments", () => {
  it("rejects a negative amount", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderFixed();
    await screen.findByText("Restaurant XYZ");

    await userEvent.clear(screen.getByLabelText("Payment Amount"));
    await userEvent.type(screen.getByLabelText("Payment Amount"), "-500");
    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));

    expect(toast.error).toHaveBeenCalledWith("Payment amount must be greater than zero.");
    expect(paymentsApi.create).not.toHaveBeenCalled();
  });

  it("rejects a zero amount", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderFixed();
    await screen.findByText("Restaurant XYZ");

    await userEvent.clear(screen.getByLabelText("Payment Amount"));
    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));

    expect(toast.error).toHaveBeenCalledWith("Payment amount must be greater than zero.");
    expect(paymentsApi.create).not.toHaveBeenCalled();
  });

  it("rejects an amount greater than the current outstanding balance", async () => {
    const toast = (await import("react-hot-toast")).default;
    renderFixed();
    await screen.findByText("Restaurant XYZ");

    await userEvent.clear(screen.getByLabelText("Payment Amount"));
    await userEvent.type(screen.getByLabelText("Payment Amount"), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("cannot exceed the current outstanding balance"));
    expect(paymentsApi.create).not.toHaveBeenCalled();
  });

  it("prevents a duplicate submission while the first request is still in flight", async () => {
    let resolveCreate!: (v: { data: { customerId: number; customerName: string; amount: number } }) => void;
    (paymentsApi.create as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { customer: { currentBalance: 0 } } });

    renderFixed();
    await screen.findByText("Restaurant XYZ");

    const submit = screen.getByRole("button", { name: "Receive Payment" });
    await userEvent.click(submit);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Saving…" }));

    resolveCreate({ data: { customerId: hotelCustomer.id, customerName: hotelCustomer.businessName, amount: 10000 } });
    await screen.findByText("Remaining Due");

    expect(paymentsApi.create).toHaveBeenCalledTimes(1);
  });
});

describe("ReceivePaymentModal — after save", () => {
  it("shows Payment Received with Customer, Amount, Remaining Due and offers New Payment / View Customer", async () => {
    (paymentsApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { customerId: hotelCustomer.id, customerName: hotelCustomer.businessName, amount: 10000 },
    });
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { customer: { currentBalance: 0 } } });

    const { onSaved } = renderFixed();
    await screen.findByText("Restaurant XYZ");

    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));

    await screen.findByText("Remaining Due");
    expect(screen.getByText("Customer").closest("div")).toHaveTextContent("Restaurant XYZ");
    expect(screen.getByText("Amount").closest("div")).toHaveTextContent("Rs. 10,000");
    expect(screen.getByText("Remaining Due").closest("div")).toHaveTextContent("Rs. 0");
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "New Payment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Customer" })).toBeInTheDocument();

    await waitFor(() => expect(customersApi.get).toHaveBeenCalledWith(hotelCustomer.id));
  });

  it("New Payment resets the form for another payment", async () => {
    (paymentsApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { customerId: hotelCustomer.id, customerName: hotelCustomer.businessName, amount: 10000 },
    });
    (customersApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { customer: { currentBalance: 0 } } });

    renderFixed();
    await screen.findByText("Restaurant XYZ");
    await userEvent.click(screen.getByRole("button", { name: "Receive Payment" }));
    await screen.findByText("Remaining Due");

    await userEvent.click(screen.getByRole("button", { name: "New Payment" }));

    expect(await screen.findByRole("button", { name: "Receive Payment" })).toBeInTheDocument();
  });
});
