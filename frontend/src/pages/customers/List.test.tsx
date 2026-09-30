import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CustomersList from "./List";
import { customersApi } from "../../api/endpoints";
import type { Customer } from "../../api/types";

vi.mock("../../api/endpoints", () => ({
  customersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1, customerCode: "CUST-2026-00001", businessName: "Restaurant XYZ", phone: "0300-0000000",
    customerType: "Restaurant", creditLimit: 100000, openingBalance: 0, currentBalance: 0, isActive: true,
    createdAt: "2026-01-01", ...overrides,
  };
}

function renderList() {
  render(<MemoryRouter><CustomersList /></MemoryRouter>);
}

describe("CustomersList — table columns", () => {
  it("shows exactly Customer, Type, Due, Phone, Action", async () => {
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [customer()], totalCount: 1 } });
    renderList();
    await screen.findByText("Restaurant XYZ");

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Customer", "Type", "Due", "Phone", "Action"]);
  });

  it("zero outstanding: shows the amount without the overdue highlight", async () => {
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { items: [customer({ currentBalance: 0 })], totalCount: 1 },
    });
    renderList();
    const row = (await screen.findByText("Restaurant XYZ")).closest("tr") as HTMLElement;
    const outstanding = within(row).getByText("Rs. 0");
    expect(outstanding.className).not.toContain("text-red-600");
  });

  it("outstanding balance: highlights a non-zero balance", async () => {
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { items: [customer({ currentBalance: 15000 })], totalCount: 1 },
    });
    renderList();
    const row = (await screen.findByText("Restaurant XYZ")).closest("tr") as HTMLElement;
    const outstanding = within(row).getByText("Rs. 15,000");
    expect(outstanding.className).toContain("text-red-600");
  });

  it("marks a deactivated customer inline instead of a separate Status column", async () => {
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { items: [customer({ isActive: false })], totalCount: 1 },
    });
    renderList();
    await screen.findByText("(Inactive)");
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
  });
});

describe("CustomersList — new customer", () => {
  beforeEach(() => {
    (customersApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [], totalCount: 0 } });
  });

  it("creates a new customer through the existing create flow", async () => {
    (customersApi.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: customer({ id: 2, businessName: "Green Valley Caterers" }) });
    renderList();
    await screen.findByText("Nothing here yet.");

    await userEvent.click(screen.getByRole("button", { name: "+ New Customer" }));
    await userEvent.type(screen.getByLabelText("Business Name"), "Green Valley Caterers");
    await userEvent.type(screen.getByLabelText("Phone"), "0301-1234567");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(customersApi.create).toHaveBeenCalledWith(expect.objectContaining({ businessName: "Green Valley Caterers", phone: "0301-1234567" }));
  });
});
