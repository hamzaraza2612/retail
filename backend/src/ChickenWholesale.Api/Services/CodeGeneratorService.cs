using ChickenWholesale.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Services;

public class CodeGeneratorService
{
    private readonly ApplicationDbContext _db;

    public CodeGeneratorService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<string> NextAsync(string prefix, Func<Task<int>> countAsync)
    {
        var count = await countAsync();
        var year = DateTime.UtcNow.Year;
        return $"{prefix}-{year}-{(count + 1):D5}";
    }

    public async Task<string> NextCustomerCodeAsync() =>
        await NextAsync("CUST", () => _db.Customers.CountAsync());

    public async Task<string> NextSupplierCodeAsync() =>
        await NextAsync("SUPP", () => _db.Suppliers.CountAsync());

    public async Task<string> NextPurchaseNumberAsync() =>
        await NextAsync("PO", () => _db.Purchases.CountAsync());

    public async Task<string> NextOrderNumberAsync() =>
        await NextAsync("SO", () => _db.SalesOrders.CountAsync());

    public async Task<string> NextInvoiceNumberAsync() =>
        await NextAsync("INV", () => _db.Invoices.CountAsync());

    public async Task<string> NextPaymentNumberAsync() =>
        await NextAsync("PAY", () => _db.Payments.CountAsync());

    public async Task<string> NextSupplierPaymentNumberAsync() =>
        await NextAsync("SPAY", () => _db.SupplierPayments.CountAsync());

    public async Task<string> NextEmployeeCodeAsync() =>
        await NextAsync("EMP", () => _db.Employees.CountAsync());
}
