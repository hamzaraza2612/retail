using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;

    public SuppliersController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
    }

    private static SupplierDto ToDto(Supplier s) => new(
        s.Id, s.SupplierCode, s.Name, s.ContactPerson, s.Phone, s.WhatsApp, s.Address, s.City,
        s.SupplierType, s.OpeningBalance, s.CurrentBalance, s.Notes, s.IsActive, s.CreatedAt);

    [HttpGet]
    public async Task<ActionResult<PagedResult<SupplierDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] SupplierType? type, [FromQuery] bool? active,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Suppliers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s => s.Name.Contains(search) || s.Phone.Contains(search) || s.SupplierCode.Contains(search));
        if (type.HasValue) query = query.Where(s => s.SupplierType == type);
        if (active.HasValue) query = query.Where(s => s.IsActive == active);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<SupplierDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SupplierDto>> GetById(int id)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        return supplier == null ? NotFound() : Ok(ToDto(supplier));
    }

    [HttpGet("{id}/purchases")]
    public async Task<ActionResult> GetPurchases(int id)
    {
        var purchases = await _db.Purchases.Where(p => p.SupplierId == id)
            .OrderByDescending(p => p.PurchaseDate)
            .Select(p => new { p.Id, p.PurchaseNumber, p.PurchaseDate, p.TotalAmount, p.PaidAmount, p.RemainingAmount, p.Status })
            .ToListAsync();
        return Ok(purchases);
    }

    [HttpGet("{id}/payments")]
    public async Task<ActionResult> GetPayments(int id)
    {
        var payments = await _db.SupplierPayments.Where(p => p.SupplierId == id)
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new { p.Id, p.PaymentNumber, p.PaymentDate, p.Amount, p.Method, p.Reference })
            .ToListAsync();
        return Ok(payments);
    }

    [HttpGet("{id}/statement")]
    public async Task<ActionResult> GetStatement(int id)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier == null) return NotFound();

        var purchases = await _db.Purchases.Where(p => p.SupplierId == id)
            .Select(p => new { Type = "Purchase", Date = p.PurchaseDate, Reference = p.PurchaseNumber, Credit = p.TotalAmount, Debit = 0m })
            .ToListAsync();
        var payments = await _db.SupplierPayments.Where(p => p.SupplierId == id)
            .Select(p => new { Type = "Payment", Date = p.PaymentDate, Reference = p.PaymentNumber, Credit = 0m, Debit = p.Amount })
            .ToListAsync();

        var ledger = purchases.Concat(payments).OrderBy(x => x.Date).ToList();
        decimal running = supplier.OpeningBalance;
        var rows = ledger.Select(l =>
        {
            running += l.Credit - l.Debit;
            return new { l.Type, l.Date, l.Reference, l.Debit, l.Credit, Balance = running };
        }).ToList();

        return Ok(new { supplier.OpeningBalance, ClosingBalance = supplier.CurrentBalance, Rows = rows });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<ActionResult<SupplierDto>> Create(CreateSupplierRequest req)
    {
        var supplier = new Supplier
        {
            SupplierCode = await _codeGen.NextSupplierCodeAsync(),
            Name = req.Name,
            ContactPerson = req.ContactPerson,
            Phone = req.Phone,
            WhatsApp = req.WhatsApp,
            Address = req.Address,
            City = req.City,
            SupplierType = req.SupplierType,
            OpeningBalance = req.OpeningBalance,
            CurrentBalance = req.OpeningBalance,
            Notes = req.Notes,
            IsActive = true
        };
        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Supplier", supplier.Id.ToString(), $"Created supplier {supplier.Name}");
        return Ok(ToDto(supplier));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<ActionResult<SupplierDto>> Update(int id, UpdateSupplierRequest req)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier == null) return NotFound();

        supplier.Name = req.Name;
        supplier.ContactPerson = req.ContactPerson;
        supplier.Phone = req.Phone;
        supplier.WhatsApp = req.WhatsApp;
        supplier.Address = req.Address;
        supplier.City = req.City;
        supplier.SupplierType = req.SupplierType;
        supplier.Notes = req.Notes;
        supplier.IsActive = req.IsActive;
        supplier.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "Supplier", supplier.Id.ToString(), $"Updated supplier {supplier.Name}");
        return Ok(ToDto(supplier));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier == null) return NotFound();
        supplier.IsActive = false;
        supplier.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DEACTIVATE", "Supplier", supplier.Id.ToString(), $"Deactivated supplier {supplier.Name}");
        return Ok(new { message = "Supplier deactivated" });
    }
}
