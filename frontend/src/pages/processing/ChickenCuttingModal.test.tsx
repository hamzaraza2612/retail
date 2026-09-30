import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChickenCuttingModal from "./ChickenCuttingModal";
import { processingBatchesApi, productsApi } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  processingBatchesApi: {
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
  productsApi: {
    list: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const rawMaterial = {
  id: 1, sku: "RM-001", name: "Raw Chicken (Whole Bird)", categoryId: 1, categoryName: "Raw Material",
  unit: "KG", purchasePrice: 550, salePrice: 550, minimumStock: 200, currentStock: 1000,
  isActive: true, createdAt: "", updatedAt: "", productType: "RawMaterial",
};

function finishedProduct(id: number, name: string) {
  return {
    id, sku: `SKU-${id}`, name, categoryId: 2, categoryName: "Finished",
    unit: "KG", purchasePrice: 500, salePrice: 600, minimumStock: 10, currentStock: 0,
    isActive: true, createdAt: "", updatedAt: "", productType: "FinishedProduct",
  };
}

const finishedProducts = [
  finishedProduct(10, "Boneless Chicken"),
  finishedProduct(11, "Chicken Breast"),
  finishedProduct(12, "Chicken Tikka Cut"),
  finishedProduct(13, "Chicken Leg"),
  finishedProduct(14, "Chicken Wings"),
  finishedProduct(15, "Chicken Neck"),
  finishedProduct(16, "Whole Chicken"),
];

function draftBatch() {
  return {
    data: {
      id: 99, batchNumber: "PB-2026-00001", processingDate: "2026-01-01", status: "Draft",
      wasteQuantity: 20, wasteUnit: "KG", createdAt: "",
      totalInputQuantity: 500, totalOutputQuantity: 480, totalAllocatedCost: 0, yieldPercent: null,
      inputs: [], outputs: [],
    },
  };
}

function completedBatch() {
  return {
    data: {
      id: 99, batchNumber: "PB-2026-00001", processingDate: "2026-01-01", status: "Completed",
      wasteQuantity: 20, wasteUnit: "KG", createdAt: "",
      totalInputQuantity: 500, totalOutputQuantity: 480, totalAllocatedCost: 275000, yieldPercent: 96,
      inputs: [{ id: 1, productId: 1, productName: "Raw Chicken (Whole Bird)", quantity: 500, unit: "KG", unitCost: 550, totalCost: 275000 }],
      outputs: [
        { id: 1, productId: 10, productName: "Boneless Chicken", quantity: 200, unit: "KG", unitCost: 572.9167, allocatedCost: 114583.33 },
        { id: 2, productId: 11, productName: "Chicken Breast", quantity: 280, unit: "KG", unitCost: 572.9167, allocatedCost: 160416.67 },
      ],
    },
  };
}

async function fillBalancedForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Input KG"), "500");
  await user.type(screen.getByLabelText("Boneless Quantity"), "200");
  await user.type(screen.getByLabelText("Breast Quantity"), "280");
  await user.type(screen.getByLabelText("Waste Loss KG"), "20");
}

describe("ChickenCuttingModal", () => {
  beforeEach(() => {
    vi.mocked(productsApi.list).mockResolvedValue({ data: { items: [rawMaterial, ...finishedProducts], totalCount: 8 } } as any);
    vi.mocked(processingBatchesApi.create).mockReset();
    vi.mocked(processingBatchesApi.updateStatus).mockReset();
  });

  it("shows raw chicken available and all seven fixed cut rows", async () => {
    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText("1000 KG")).toBeInTheDocument();
    for (const label of ["Boneless", "Breast", "Tikka", "Leg", "Wings", "Neck", "Whole Chicken"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows BALANCED and enables COMPLETE CUTTING for the worked example (500/480/20)", async () => {
    const user = userEvent.setup();
    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("1000 KG");
    await fillBalancedForm(user);

    expect(await screen.findByText("BALANCED")).toBeInTheDocument();
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COMPLETE CUTTING" })).not.toBeDisabled();
  });

  it("shows NOT BALANCED and disables COMPLETE CUTTING when quantities don't add up", async () => {
    const user = userEvent.setup();
    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("1000 KG");
    await user.type(screen.getByLabelText("Input KG"), "500");
    await user.type(screen.getByLabelText("Boneless Quantity"), "200");
    await user.type(screen.getByLabelText("Waste Loss KG"), "20");

    expect(await screen.findByText("NOT BALANCED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "COMPLETE CUTTING" })).toBeDisabled();
  });

  it("completes cutting: creates draft then confirms, and shows the after-completion summary with no batch IDs", async () => {
    const user = userEvent.setup();
    vi.mocked(processingBatchesApi.create).mockResolvedValue(draftBatch() as any);
    vi.mocked(processingBatchesApi.updateStatus).mockResolvedValue(completedBatch() as any);
    const onSaved = vi.fn();

    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={onSaved} />);
    await screen.findByText("1000 KG");
    await fillBalancedForm(user);
    await user.click(screen.getByRole("button", { name: "COMPLETE CUTTING" }));

    await waitFor(() => expect(processingBatchesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        inputs: [{ productId: 1, quantity: 500 }],
        outputs: expect.arrayContaining([
          { productId: 10, quantity: 200 },
          { productId: 11, quantity: 280 },
        ]),
        wasteQuantity: 20,
      })
    ));
    expect(processingBatchesApi.updateStatus).toHaveBeenCalledWith(99, "Completed");
    expect(onSaved).toHaveBeenCalled();

    expect(await screen.findByText("Raw Chicken Consumed")).toBeInTheDocument();
    expect(screen.getByText("500 KG")).toBeInTheDocument();
    expect(screen.getByText("Finished Stock Added")).toBeInTheDocument();
    expect(screen.getByText("480 KG")).toBeInTheDocument();
    expect(screen.getByText("Estimated Cost/KG")).toBeInTheDocument();

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/PB-2026|ProcessingBatch|batch\s*#/i);
  });

  it("on completion failure, cancels the draft and surfaces the backend error without leaving an orphaned batch", async () => {
    const user = userEvent.setup();
    vi.mocked(processingBatchesApi.create).mockResolvedValue(draftBatch() as any);
    vi.mocked(processingBatchesApi.updateStatus).mockRejectedValue({
      response: { data: { error: "Unbalanced processing batch" } },
    });

    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("1000 KG");
    await fillBalancedForm(user);
    await user.click(screen.getByRole("button", { name: "COMPLETE CUTTING" }));

    await waitFor(() => expect(processingBatchesApi.updateStatus).toHaveBeenCalledWith(99, "Completed"));
    await waitFor(() => expect(processingBatchesApi.updateStatus).toHaveBeenCalledWith(99, "Cancelled"));
    expect(screen.getByRole("button", { name: "COMPLETE CUTTING" })).toBeInTheDocument();
  });

  it("prevents duplicate submission while saving", async () => {
    const user = userEvent.setup();
    let resolveCreate: (v: any) => void = () => {};
    vi.mocked(processingBatchesApi.create).mockImplementation(() => new Promise((res) => { resolveCreate = res; }));
    vi.mocked(processingBatchesApi.updateStatus).mockResolvedValue(completedBatch() as any);

    render(<ChickenCuttingModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByText("1000 KG");
    await fillBalancedForm(user);

    const button = screen.getByRole("button", { name: "COMPLETE CUTTING" });
    await user.click(button);
    await user.click(button);

    expect(processingBatchesApi.create).toHaveBeenCalledTimes(1);
    resolveCreate(draftBatch());
    await screen.findByText("Raw Chicken Consumed");
  });
});
