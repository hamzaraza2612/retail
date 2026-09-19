namespace ChickenWholesale.Api.Models;

/// <summary>
/// One cutting/processing operation: raw material goes in, one or more finished products
/// (plus waste/loss) come out. Only a Completed batch has touched inventory — see
/// ProcessingBatchesController's transition table. Costing: the total cost of the inputs
/// consumed is allocated across the outputs by weight (see BUSINESS_WORKFLOW.md).
/// </summary>
public class ProcessingBatch
{
    public int Id { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime ProcessingDate { get; set; }
    public ProcessingBatchStatus Status { get; set; } = ProcessingBatchStatus.Draft;
    public decimal WasteQuantity { get; set; }
    public UnitOfMeasure WasteUnit { get; set; }
    public string? WasteReason { get; set; }
    public string? Notes { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProcessingInput> Inputs { get; set; } = new List<ProcessingInput>();
    public ICollection<ProcessingOutput> Outputs { get; set; } = new List<ProcessingOutput>();
}

/// <summary>Raw material consumed by a processing batch. UnitCost is the raw material's cost
/// basis at the time of processing (Product.PurchasePrice — see BUSINESS_WORKFLOW.md for why),
/// captured here so it stays historically correct even if that product's cost changes later.</summary>
public class ProcessingInput
{
    public int Id { get; set; }
    public int ProcessingBatchId { get; set; }
    public ProcessingBatch? ProcessingBatch { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Quantity { get; set; }
    public UnitOfMeasure Unit { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TotalCost { get; set; }
}

/// <summary>A finished product produced by a processing batch. UnitCost/AllocatedCost are the
/// weight-based share of the batch's total input cost assigned to this output line.</summary>
public class ProcessingOutput
{
    public int Id { get; set; }
    public int ProcessingBatchId { get; set; }
    public ProcessingBatch? ProcessingBatch { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Quantity { get; set; }
    public UnitOfMeasure Unit { get; set; }
    public decimal UnitCost { get; set; }
    public decimal AllocatedCost { get; set; }
}
