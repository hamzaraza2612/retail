import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExpensesList from "./List";
import { expensesApi } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  expensesApi: { list: vi.fn(), categories: vi.fn(), create: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const CATEGORIES = [
  { id: 1, name: "Rent" },
  { id: 2, name: "Electricity" },
  { id: 3, name: "Miscellaneous" },
  { id: 4, name: "Transport" },
  { id: 5, name: "Salaries" },
  { id: 6, name: "Packaging" },
  { id: 7, name: "Fuel" },
];

function emptyList() {
  return { data: { items: [], totalCount: 0 } };
}

describe("ExpensesList (simplified)", () => {
  beforeEach(() => {
    vi.mocked(expensesApi.list).mockResolvedValue(emptyList() as any);
    vi.mocked(expensesApi.categories).mockResolvedValue({ data: CATEGORIES } as any);
    vi.mocked(expensesApi.create).mockReset();
  });

  it("shows exactly the simple fields: Date, Category, Amount, Description, Save Expense", async () => {
    render(<ExpensesList />);

    expect(await screen.findByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Expense" })).toBeInTheDocument();

    expect(screen.queryByLabelText(/Paid By/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Payment Method/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Receipt Reference/i)).not.toBeInTheDocument();
  });

  it("prioritizes the business-relevant categories at the top of the picker without hiding the rest", async () => {
    render(<ExpensesList />);

    const select = await screen.findByLabelText("Category") as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(CATEGORIES.length + 1));

    const optionNames = Array.from(select.options).map((o) => o.textContent);
    expect(optionNames).toEqual([
      "Select category…", "Electricity", "Transport", "Packaging", "Salaries", "Miscellaneous", "Fuel", "Rent",
    ]);
  });

  it("saves an expense with just the simple fields, defaulting payment method silently", async () => {
    const user = userEvent.setup();
    vi.mocked(expensesApi.create).mockResolvedValue({ data: {} } as any);

    render(<ExpensesList />);
    await screen.findByLabelText("Date");

    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.type(screen.getByLabelText("Amount"), "500");
    await user.type(screen.getByLabelText("Description"), "Ice for the day");
    await user.click(screen.getByRole("button", { name: "Save Expense" }));

    await waitFor(() => expect(expensesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 2, amount: 500, description: "Ice for the day", paymentMethod: "Cash" })
    ));
  });

  it("requires category, amount and description before saving", async () => {
    const user = userEvent.setup();
    render(<ExpensesList />);
    await screen.findByLabelText("Date");

    await user.click(screen.getByRole("button", { name: "Save Expense" }));

    expect(expensesApi.create).not.toHaveBeenCalled();
  });
});
