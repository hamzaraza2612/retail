namespace ChickenWholesale.Api.Models;

public class Customer
{
    public int Id { get; set; }
    public string CustomerCode { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? WhatsApp { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public CustomerType CustomerType { get; set; }
    public decimal CreditLimit { get; set; }
    public string? PaymentTerms { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal CurrentBalance { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SalesOrder> SalesOrders { get; set; } = new List<SalesOrder>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<Delivery> Deliveries { get; set; } = new List<Delivery>();
}
