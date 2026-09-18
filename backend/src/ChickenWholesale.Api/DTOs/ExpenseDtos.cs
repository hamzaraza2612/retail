using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record ExpenseCategoryDto(int Id, string Name);

public record CreateExpenseRequest(
    [Required] int CategoryId,
    [Range(0.01, double.MaxValue)] decimal Amount,
    DateTime? Date,
    string? PaidBy,
    [Required] PaymentMethod PaymentMethod,
    [Required] string Description,
    string? ReceiptReference,
    string? Notes
);

public record ExpenseDto(
    int Id, int CategoryId, string CategoryName, decimal Amount, DateTime Date, string? PaidBy,
    PaymentMethod PaymentMethod, string Description, string? ReceiptReference, string? Notes, DateTime CreatedAt
);
