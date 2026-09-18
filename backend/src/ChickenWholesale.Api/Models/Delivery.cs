namespace ChickenWholesale.Api.Models;

public class Delivery
{
    public int Id { get; set; }
    public int SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public string? DeliveryAddress { get; set; }
    public int? DriverEmployeeId { get; set; }
    public Employee? DriverEmployee { get; set; }
    public string? Vehicle { get; set; }
    public DateTime? DeliveryDate { get; set; }
    public string? DeliveryTime { get; set; }
    public DeliveryStatus Status { get; set; } = DeliveryStatus.Pending;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
