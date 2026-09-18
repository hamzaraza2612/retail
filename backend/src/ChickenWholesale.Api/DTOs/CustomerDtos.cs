using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record CustomerDto(
    int Id, string CustomerCode, string BusinessName, string? ContactPerson, string Phone,
    string? WhatsApp, string? Address, string? City, CustomerType CustomerType,
    decimal CreditLimit, string? PaymentTerms, decimal OpeningBalance, decimal CurrentBalance,
    string? Notes, bool IsActive, DateTime CreatedAt
);

public record CreateCustomerRequest(
    [Required] string BusinessName,
    string? ContactPerson,
    [Required] string Phone,
    string? WhatsApp,
    string? Address,
    string? City,
    [Required] CustomerType CustomerType,
    decimal CreditLimit,
    string? PaymentTerms,
    decimal OpeningBalance,
    string? Notes
);

public record UpdateCustomerRequest(
    [Required] string BusinessName,
    string? ContactPerson,
    [Required] string Phone,
    string? WhatsApp,
    string? Address,
    string? City,
    [Required] CustomerType CustomerType,
    decimal CreditLimit,
    string? PaymentTerms,
    string? Notes,
    bool IsActive
);

public record CustomerDetailDto(
    CustomerDto Customer,
    decimal TotalPurchases,
    decimal TotalPaid,
    DateTime? LastOrderDate,
    int TotalOrders
);

public record PagedResult<T>(List<T> Items, int TotalCount, int Page, int PageSize);
