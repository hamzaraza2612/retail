using ChickenWholesale.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Services;

/// <summary>
/// Generates human-readable business identifiers (CUST-2026-00001, SO-2026-00042, ...).
///
/// This used to be COUNT(*)+1 per entity, which is not safe under concurrency: two
/// requests creating a customer (or order, invoice, purchase, ...) at nearly the same
/// moment can both read the same count before either commits, generating the same code
/// and crashing the second request on the unique-index violation. Real-world business
/// identifiers like invoice/order numbers are exactly the case worth getting right, so
/// this is now backed by a real Postgres SEQUENCE per entity type (see migration
/// AddCodeGenerationSequences) — nextval() is atomic and collision-free by construction,
/// with no locking, retries, or extra tables required. The code format itself
/// (PREFIX-YYYY-NNNNN) is unchanged.
/// </summary>
public class CodeGeneratorService
{
    private readonly ApplicationDbContext _db;

    public CodeGeneratorService(ApplicationDbContext db)
    {
        _db = db;
    }

    private async Task<string> NextAsync(string prefix, string sequenceName)
    {
        // SqlQuery (not SqlQueryRaw) binds sequenceName as a real parameter rather than
        // splicing it into the SQL text — defense in depth, even though every caller here
        // passes one of our own hardcoded sequence names, never user input.
        var next = await _db.Database.SqlQuery<long>($"SELECT nextval({sequenceName}) AS \"Value\"").FirstAsync();
        var year = DateTime.UtcNow.Year;
        return $"{prefix}-{year}-{next:D5}";
    }

    public Task<string> NextCustomerCodeAsync() => NextAsync("CUST", "customer_code_seq");
    public Task<string> NextSupplierCodeAsync() => NextAsync("SUPP", "supplier_code_seq");
    public Task<string> NextPurchaseNumberAsync() => NextAsync("PO", "purchase_number_seq");
    public Task<string> NextOrderNumberAsync() => NextAsync("SO", "order_number_seq");
    public Task<string> NextInvoiceNumberAsync() => NextAsync("INV", "invoice_number_seq");
    public Task<string> NextPaymentNumberAsync() => NextAsync("PAY", "payment_number_seq");
    public Task<string> NextSupplierPaymentNumberAsync() => NextAsync("SPAY", "supplier_payment_number_seq");
    public Task<string> NextEmployeeCodeAsync() => NextAsync("EMP", "employee_code_seq");
}
