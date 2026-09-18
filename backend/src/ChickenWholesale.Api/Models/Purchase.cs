namespace ChickenWholesale.Api.Models;

public class Purchase
{
    public int Id { get; set; }
    public string PurchaseNumber { get; set; } = string.Empty;
    public int SupplierId { get; set; }
    public Supplier? Supplier { get; set; }
    public DateTime PurchaseDate { get; set; }
    public string? InvoiceNumber { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string? Notes { get; set; }
    public PurchaseStatus Status { get; set; } = PurchaseStatus.Confirmed;
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PurchaseItem> Items { get; set; } = new List<PurchaseItem>();
}

public class PurchaseItem
{
    public int Id { get; set; }
    public int PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal Quantity { get; set; }
    public UnitOfMeasure Unit { get; set; }
    public decimal Rate { get; set; }
    public decimal Total { get; set; }
}
