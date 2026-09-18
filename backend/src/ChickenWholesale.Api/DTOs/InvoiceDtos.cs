using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record InvoiceDto(
    int Id, string InvoiceNumber, int SalesOrderId, string OrderNumber, int CustomerId, string CustomerName,
    string? CustomerPhone, string? CustomerAddress, DateTime InvoiceDate, decimal Subtotal, decimal Discount,
    decimal DeliveryCharges, decimal GrandTotal, decimal PaidAmount, decimal BalanceAmount,
    PaymentStatus PaymentStatus, List<SalesOrderItemDto> Items
);
