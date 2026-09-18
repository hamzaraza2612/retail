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
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    public string? Notes { get; set; }
}
