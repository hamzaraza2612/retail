using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record CreatePaymentRequest(
    [Required] int CustomerId,
    int? InvoiceId,
    [Range(0.01, 100_000_000)] decimal Amount,
    DateTime? PaymentDate,
    [Required] PaymentMethod Method,
    string? Reference,
    string? Notes
);

public record PaymentDto(
    int Id, string PaymentNumber, int CustomerId, string CustomerName, int? InvoiceId, string? InvoiceNumber,
    decimal Amount, DateTime PaymentDate, PaymentMethod Method, string? Reference, string? Notes
);

public record CreateSupplierPaymentRequest(
    [Required] int SupplierId,
    int? PurchaseId,
    [Range(0.01, 100_000_000)] decimal Amount,
    DateTime? PaymentDate,
    [Required] PaymentMethod Method,
    string? Reference,
    string? Notes
);

public record SupplierPaymentDto(
    int Id, string PaymentNumber, int SupplierId, string SupplierName, int? PurchaseId, string? PurchaseNumber,
    decimal Amount, DateTime PaymentDate, PaymentMethod Method, string? Reference, string? Notes
);
