using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Services;

public record InvoicePaymentResult(bool Success, decimal PaidAmount, decimal BalanceAmount, PaymentStatus PaymentStatus);
public record PurchasePaymentResult(bool Success);

/// <summary>
/// All balance mutations here use EF Core's ExecuteUpdateAsync, which compiles to a single
/// atomic "UPDATE ... SET col = col + @delta [WHERE cap-check]" statement. This avoids the
/// classic read-modify-write lost-update race (two concurrent payments/orders against the
/// same customer/invoice both reading the pre-update value) because Postgres row-locks on
/// UPDATE and re-evaluates against the latest committed row, not the caller's stale read.
/// Callers must invoke these within their own DB transaction alongside the related record.
/// </summary>
public class LedgerService
{
    private readonly ApplicationDbContext _db;

    public LedgerService(ApplicationDbContext db)
    {
        _db = db;
    }

    public Task AdjustCustomerBalanceAsync(int customerId, decimal delta) =>
        _db.Customers.Where(c => c.Id == customerId).ExecuteUpdateAsync(s => s
            .SetProperty(c => c.CurrentBalance, c => c.CurrentBalance + delta)
            .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));

    public Task AdjustSupplierBalanceAsync(int supplierId, decimal delta) =>
        _db.Suppliers.Where(s => s.Id == supplierId).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.CurrentBalance, x => x.CurrentBalance + delta)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

    /// <summary>
    /// Atomically applies a payment to an invoice, capped at its current outstanding
    /// balance, and cascades the same amount onto the linked sales order. Returns
    /// Success = false (no rows touched) if the amount exceeds the balance at the moment
    /// of the update — including when a concurrent payment shrank it after the caller's
    /// own pre-check.
    /// </summary>
    public async Task<InvoicePaymentResult> ApplyInvoicePaymentAsync(int invoiceId, decimal amount)
    {
        var affected = await _db.Invoices
            .Where(i => i.Id == invoiceId && i.BalanceAmount >= amount)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.PaidAmount, i => i.PaidAmount + amount)
                .SetProperty(i => i.BalanceAmount, i => i.BalanceAmount - amount));

        if (affected == 0)
            return new InvoicePaymentResult(false, 0, 0, PaymentStatus.Unpaid);

        var updated = await _db.Invoices.AsNoTracking().Where(i => i.Id == invoiceId)
            .Select(i => new { i.PaidAmount, i.BalanceAmount, i.SalesOrderId })
            .FirstAsync();

        var status = updated.BalanceAmount <= 0 ? PaymentStatus.Paid
            : (updated.PaidAmount > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid);

        await _db.Invoices.Where(i => i.Id == invoiceId)
            .ExecuteUpdateAsync(s => s.SetProperty(i => i.PaymentStatus, status));

        await _db.SalesOrders.Where(o => o.Id == updated.SalesOrderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.PaidAmount, o => o.PaidAmount + amount)
                .SetProperty(o => o.RemainingAmount, o => o.RemainingAmount - amount)
                .SetProperty(o => o.PaymentStatus, status)
                .SetProperty(o => o.UpdatedAt, DateTime.UtcNow));

        return new InvoicePaymentResult(true, updated.PaidAmount, updated.BalanceAmount, status);
    }

    /// <summary>
    /// Atomically applies a payment to a purchase, capped at its current remaining
    /// balance. Returns Success = false if the amount exceeds the balance at the moment
    /// of the update (including a concurrent payment shrinking it first).
    /// </summary>
    public async Task<PurchasePaymentResult> ApplyPurchasePaymentAsync(int purchaseId, decimal amount)
    {
        var affected = await _db.Purchases
            .Where(p => p.Id == purchaseId && p.RemainingAmount >= amount)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.PaidAmount, p => p.PaidAmount + amount)
                .SetProperty(p => p.RemainingAmount, p => p.RemainingAmount - amount));

        return new PurchasePaymentResult(affected > 0);
    }
}
