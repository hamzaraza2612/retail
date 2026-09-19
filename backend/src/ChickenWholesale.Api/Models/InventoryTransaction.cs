namespace ChickenWholesale.Api.Models;

public class InventoryTransaction
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public InventoryMovementType MovementType { get; set; }
    public decimal Quantity { get; set; }
    public UnitOfMeasure Unit { get; set; }
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public decimal StockAfter { get; set; }
    // Cost per unit at the moment of this specific movement (actual rate paid on a
    // purchase, allocated processing cost on a processing output, the product's cost
    // basis at the moment of a sale, ...). Historical and immutable once written, so
    // COGS for a past sale stays correct even if the product's current cost changes
    // later — see BUSINESS_WORKFLOW.md "Cost history". Null/0 for movement types that
    // have no natural cost (manual adjustments, returns, waste).
    public decimal? UnitCost { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    public string? Notes { get; set; }
}
