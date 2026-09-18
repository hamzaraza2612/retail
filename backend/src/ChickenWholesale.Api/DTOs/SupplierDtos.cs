using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record SupplierDto(
    int Id, string SupplierCode, string Name, string? ContactPerson, string Phone,
    string? WhatsApp, string? Address, string? City, SupplierType SupplierType,
    decimal OpeningBalance, decimal CurrentBalance, string? Notes, bool IsActive, DateTime CreatedAt
);

public record CreateSupplierRequest(
    [Required] string Name,
    string? ContactPerson,
    [Required] string Phone,
    string? WhatsApp,
    string? Address,
    string? City,
    [Required] SupplierType SupplierType,
    decimal OpeningBalance,
    string? Notes
);

public record UpdateSupplierRequest(
    [Required] string Name,
    string? ContactPerson,
    [Required] string Phone,
    string? WhatsApp,
    string? Address,
    string? City,
    [Required] SupplierType SupplierType,
    string? Notes,
    bool IsActive
);
