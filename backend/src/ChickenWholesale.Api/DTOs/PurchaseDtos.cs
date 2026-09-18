using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record PurchaseItemRequest(
    [Required] int ProductId,
    [Range(0.001, 1_000_000)] decimal Quantity,
    [Range(0, 100_000_000)] decimal Rate
);

public record CreatePurchaseRequest(
    [Required] int SupplierId,
    DateTime? PurchaseDate,
    string? InvoiceNumber,
    [Required, MinLength(1)] List<PurchaseItemRequest> Items,
    [Range(0, 100_000_000)] decimal PaidAmount,
    string? Notes
);

public record PurchaseItemDto(int Id, int ProductId, string ProductName, decimal Quantity, UnitOfMeasure Unit, decimal Rate, decimal Total);

public record PurchaseDto(
    int Id, string PurchaseNumber, int SupplierId, string SupplierName, DateTime PurchaseDate,
    string? InvoiceNumber, decimal Subtotal, decimal TotalAmount, decimal PaidAmount, decimal RemainingAmount,
    PurchaseStatus Status, string? Notes, DateTime CreatedAt, List<PurchaseItemDto> Items
);
