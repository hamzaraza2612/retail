using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record StockAdjustmentRequest(
    [Required] int ProductId,
    decimal Quantity, // signed: positive = ADJUSTMENT_IN or negative = ADJUSTMENT_OUT/WASTE
    [Required] InventoryMovementType MovementType,
    [Required] string Reason
);

public record InventoryMovementDto(
    int Id, int ProductId, string ProductName, InventoryMovementType MovementType,
    decimal Quantity, UnitOfMeasure Unit, string? ReferenceType, int? ReferenceId,
    decimal StockAfter, DateTime Date, string? Notes
);

public record InventoryDashboardDto(
    int TotalProducts, int LowStockCount, decimal TotalStockValue, List<ProductDto> LowStockProducts
);
