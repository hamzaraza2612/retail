namespace ChickenWholesale.Api.Models;

public class Invoice
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal DeliveryCharges { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal BalanceAmount { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Unpaid;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
