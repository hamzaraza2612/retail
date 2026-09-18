using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/supplier-payments")]
[Authorize(Roles = "Admin,Manager,StoreKeeper,Cashier")]
public class SupplierPaymentsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;
    private readonly LedgerService _ledger;
    private readonly CurrentUserService _currentUser;

    public SupplierPaymentsController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen, LedgerService ledger, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
        _ledger = ledger;
        _currentUser = currentUser;
    }

    private static SupplierPaymentDto ToDto(SupplierPayment p) => new(
        p.Id, p.PaymentNumber, p.SupplierId, p.Supplier?.Name ?? "", p.PurchaseId, p.Purchase?.PurchaseNumber,
        p.Amount, p.PaymentDate, p.Method, p.Reference, p.Notes);

    [HttpGet]
    public async Task<ActionResult<PagedResult<SupplierPaymentDto>>> GetAll(
        [FromQuery] int? supplierId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.SupplierPayments.Include(p => p.Supplier).Include(p => p.Purchase).AsQueryable();
        if (supplierId.HasValue) query = query.Where(p => p.SupplierId == supplierId);
        if (from.HasValue) query = query.Where(p => p.PaymentDate >= from);
        if (to.HasValue) query = query.Where(p => p.PaymentDate <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.PaymentDate).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<SupplierPaymentDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<SupplierPaymentDto>> Create(CreateSupplierPaymentRequest req)
    {
        var supplier = await _db.Suppliers.FindAsync(req.SupplierId);
        if (supplier == null) return BadRequest(new { error = "Supplier not found" });

        Purchase? purchase = null;
        if (req.PurchaseId.HasValue)
        {
            purchase = await _db.Purchases.FindAsync(req.PurchaseId);
            if (purchase == null) return BadRequest(new { error = "Purchase not found" });
            if (purchase.SupplierId != req.SupplierId) return BadRequest(new { error = "Purchase does not belong to this supplier" });
            if (req.Amount > purchase.RemainingAmount)
                return BadRequest(new { error = $"Amount exceeds purchase remaining balance of Rs. {purchase.RemainingAmount}" });
        }

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var payment = new SupplierPayment
            {
                PaymentNumber = await _codeGen.NextSupplierPaymentNumberAsync(),
                SupplierId = req.SupplierId,
                PurchaseId = req.PurchaseId,
                Amount = req.Amount,
                PaymentDate = req.PaymentDate ?? DateTime.UtcNow,
                Method = req.Method,
                Reference = req.Reference,
                Notes = req.Notes,
                CreatedByUserId = _currentUser.UserId
            };
            _db.SupplierPayments.Add(payment);

            if (purchase != null)
            {
                var result = await _ledger.ApplyPurchasePaymentAsync(purchase.Id, req.Amount);
                if (!result.Success)
                {
                    await tx.RollbackAsync();
                    return BadRequest(new { error = "Amount exceeds the purchase's current remaining balance (it may have just been paid by another transaction). Please refresh and try again." });
                }
            }

            await _ledger.AdjustSupplierBalanceAsync(supplier.Id, -req.Amount);

            await _db.SaveChangesAsync();
            await _audit.LogAsync("SUPPLIER_PAYMENT", "Supplier", supplier.Id.ToString(),
                $"Paid Rs.{payment.Amount} to {supplier.Name} ({payment.Method})");
            await tx.CommitAsync();

            await _db.Entry(payment).Reference(p => p.Supplier).LoadAsync();
            if (payment.PurchaseId.HasValue) await _db.Entry(payment).Reference(p => p.Purchase).LoadAsync();

            return Ok(ToDto(payment));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
