using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record ProductDto(
    int Id, string SKU, string Name, int CategoryId, string CategoryName, UnitOfMeasure Unit,
    decimal PurchasePrice, decimal SalePrice, decimal MinimumStock, decimal CurrentStock,
    string? Description, bool IsActive, DateTime CreatedAt, DateTime UpdatedAt
);

public record CreateProductRequest(
    [Required] string SKU,
    [Required] string Name,
    [Required] int CategoryId,
    [Required] UnitOfMeasure Unit,
    [Range(0, 100_000_000)] decimal PurchasePrice,
    [Range(0, 100_000_000)] decimal SalePrice,
    [Range(0, 1_000_000)] decimal MinimumStock,
    string? Description
);

public record UpdateProductRequest(
    [Required] string Name,
    [Required] int CategoryId,
    [Required] UnitOfMeasure Unit,
    [Range(0, 100_000_000)] decimal PurchasePrice,
    [Range(0, 100_000_000)] decimal SalePrice,
    [Range(0, 1_000_000)] decimal MinimumStock,
    string? Description,
    bool IsActive
);

public record ProductCategoryDto(int Id, string Name);
