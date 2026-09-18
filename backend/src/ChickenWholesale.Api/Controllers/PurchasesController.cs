using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/purchases")]
[Authorize(Roles = "Admin,Manager,StoreKeeper")]
public class PurchasesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;
    private readonly InventoryService _inventory;
    private readonly LedgerService _ledger;
    private readonly CurrentUserService _currentUser;

    public PurchasesController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen,
        InventoryService inventory, LedgerService ledger, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
        _inventory = inventory;
        _ledger = ledger;
        _currentUser = currentUser;
    }

    private static PurchaseDto ToDto(Purchase p) => new(
        p.Id, p.PurchaseNumber, p.SupplierId, p.Supplier?.Name ?? "", p.PurchaseDate, p.InvoiceNumber,
        p.Subtotal, p.TotalAmount, p.PaidAmount, p.RemainingAmount, p.Status, p.Notes, p.CreatedAt,
        p.Items.Select(i => new PurchaseItemDto(i.Id, i.ProductId, i.Product?.Name ?? "", i.Quantity, i.Unit, i.Rate, i.Total)).ToList()
    );

    [HttpGet]
    public async Task<ActionResult<PagedResult<PurchaseDto>>> GetAll(
        [FromQuery] int? supplierId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Purchases.Include(p => p.Supplier).Include(p => p.Items).ThenInclude(i => i.Product).AsQueryable();
        if (supplierId.HasValue) query = query.Where(p => p.SupplierId == supplierId);
        if (from.HasValue) query = query.Where(p => p.PurchaseDate >= from);
        if (to.HasValue) query = query.Where(p => p.PurchaseDate <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.PurchaseDate)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<PurchaseDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PurchaseDto>> GetById(int id)
    {
        var purchase = await _db.Purchases.Include(p => p.Supplier).Include(p => p.Items).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(p => p.Id == id);
        return purchase == null ? NotFound() : Ok(ToDto(purchase));
    }

    [HttpPost]
    public async Task<ActionResult<PurchaseDto>> Create(CreatePurchaseRequest req)
    {
        var supplier = await _db.Suppliers.FindAsync(req.SupplierId);
        if (supplier == null) return BadRequest(new { error = "Supplier not found" });
        if (!supplier.IsActive) return BadRequest(new { error = $"Supplier '{supplier.Name}' is deactivated and cannot receive new purchases" });
        if (req.PaidAmount < 0) return BadRequest(new { error = "Paid amount cannot be negative" });

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var purchaseNumber = await _codeGen.NextPurchaseNumberAsync();
            var purchase = new Purchase
            {
                PurchaseNumber = purchaseNumber,
                SupplierId = req.SupplierId,
                PurchaseDate = req.PurchaseDate ?? DateTime.UtcNow,
                InvoiceNumber = req.InvoiceNumber,
                Status = PurchaseStatus.Confirmed,
                CreatedByUserId = _currentUser.UserId,
                Notes = req.Notes
            };

            decimal subtotal = 0;
            foreach (var itemReq in req.Items)
            {
                var product = await _db.Products.FindAsync(itemReq.ProductId);
                if (product == null) return BadRequest(new { error = $"Product {itemReq.ProductId} not found" });
                if (!product.IsActive) return BadRequest(new { error = $"Product '{product.Name}' is deactivated and cannot be purchased" });

                var total = itemReq.Quantity * itemReq.Rate;
                subtotal += total;
                purchase.Items.Add(new PurchaseItem
                {
                    ProductId = product.Id,
                    Quantity = itemReq.Quantity,
                    Unit = product.Unit,
                    Rate = itemReq.Rate,
                    Total = total
                });
            }

            if (req.PaidAmount > subtotal)
                return BadRequest(new { error = "Paid amount cannot exceed total amount" });

            purchase.Subtotal = subtotal;
            purchase.TotalAmount = subtotal;
            purchase.PaidAmount = req.PaidAmount;
            purchase.RemainingAmount = subtotal - req.PaidAmount;

            _db.Purchases.Add(purchase);
            await _db.SaveChangesAsync();

            foreach (var item in purchase.Items)
            {
                await _inventory.ApplyMovementAsync(item.ProductId, item.Quantity, InventoryMovementType.PURCHASE,
                    "Purchase", purchase.Id, $"Purchase {purchase.PurchaseNumber}", allowNegative: true);
            }

            await _ledger.AdjustSupplierBalanceAsync(supplier.Id, purchase.RemainingAmount);

            await _db.SaveChangesAsync();
            await _audit.LogAsync("CREATE", "Purchase", purchase.Id.ToString(),
                $"Purchase {purchase.PurchaseNumber} from {supplier.Name}: Rs.{purchase.TotalAmount}");

            await tx.CommitAsync();

            await _db.Entry(purchase).Reference(p => p.Supplier).LoadAsync();
            foreach (var i in purchase.Items) await _db.Entry(i).Reference(x => x.Product).LoadAsync();

            return Ok(ToDto(purchase));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
