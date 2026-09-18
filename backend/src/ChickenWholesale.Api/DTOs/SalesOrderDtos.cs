using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record SalesOrderItemRequest(
    [Required] int ProductId,
    [Range(0.001, 1_000_000)] decimal Quantity,
    [Range(0, 100_000_000)] decimal Rate
);

public record CreateSalesOrderRequest(
    [Required] int CustomerId,
    DateTime? OrderDate,
    DateTime? DeliveryDate,
    [Required, MinLength(1)] List<SalesOrderItemRequest> Items,
    [Range(0, 100_000_000)] decimal Discount,
    [Range(0, 100_000_000)] decimal DeliveryCharges,
    [Range(0, 100_000_000)] decimal PaidAmount,
    string? Notes
);

public record UpdateOrderStatusRequest([Required] SalesOrderStatus Status);

public record SalesOrderItemDto(int Id, int ProductId, string ProductName, decimal Quantity, UnitOfMeasure Unit, decimal Rate, decimal Total);

public record SalesOrderDto(
    int Id, string OrderNumber, int CustomerId, string CustomerName, DateTime OrderDate, DateTime? DeliveryDate,
    decimal Subtotal, decimal Discount, decimal DeliveryCharges, decimal GrandTotal, decimal PaidAmount,
    decimal RemainingAmount, SalesOrderStatus Status, PaymentStatus PaymentStatus, string? Notes,
    DateTime CreatedAt, List<SalesOrderItemDto> Items
);
