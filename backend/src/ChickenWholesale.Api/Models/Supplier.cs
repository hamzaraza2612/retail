namespace ChickenWholesale.Api.Models;

public class Supplier
{
    public int Id { get; set; }
    public string SupplierCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? WhatsApp { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public SupplierType SupplierType { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal CurrentBalance { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Purchase> Purchases { get; set; } = new List<Purchase>();
    public ICollection<SupplierPayment> SupplierPayments { get; set; } = new List<SupplierPayment>();
}
