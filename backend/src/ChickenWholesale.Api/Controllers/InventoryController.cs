using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly InventoryService _inventory;

    private static readonly InventoryMovementType[] AllowedManualTypes =
    {
        InventoryMovementType.ADJUSTMENT_IN, InventoryMovementType.ADJUSTMENT_OUT,
        InventoryMovementType.WASTE, InventoryMovementType.RETURN_IN, InventoryMovementType.RETURN_OUT
    };

    public InventoryController(ApplicationDbContext db, AuditService audit, InventoryService inventory)
    {
        _db = db;
        _audit = audit;
        _inventory = inventory;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<InventoryDashboardDto>> Dashboard()
    {
        var products = await _db.Products.Include(p => p.Category).Where(p => p.IsActive).ToListAsync();
        var lowStock = products.Where(p => p.CurrentStock <= p.MinimumStock).ToList();
        var stockValue = products.Sum(p => p.CurrentStock * p.PurchasePrice);

        return Ok(new InventoryDashboardDto(
            products.Count,
            lowStock.Count,
            stockValue,
            lowStock.Select(p => new ProductDto(p.Id, p.SKU, p.Name, p.CategoryId, p.Category?.Name ?? "", p.Unit,
                p.PurchasePrice, p.SalePrice, p.MinimumStock, p.CurrentStock, p.Description, p.IsActive, p.CreatedAt, p.UpdatedAt)).ToList()
        ));
    }

    [HttpGet("movements")]
    public async Task<ActionResult<PagedResult<InventoryMovementDto>>> GetMovements(
        [FromQuery] int? productId, [FromQuery] InventoryMovementType? type,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.InventoryTransactions.Include(m => m.Product).AsQueryable();
        if (productId.HasValue) query = query.Where(m => m.ProductId == productId);
        if (type.HasValue) query = query.Where(m => m.MovementType == type);
        if (from.HasValue) query = query.Where(m => m.Date >= from);
        if (to.HasValue) query = query.Where(m => m.Date <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(m => m.Date).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new PagedResult<InventoryMovementDto>(
            items.Select(m => new InventoryMovementDto(m.Id, m.ProductId, m.Product?.Name ?? "", m.MovementType,
                m.Quantity, m.Unit, m.ReferenceType, m.ReferenceId, m.StockAfter, m.Date, m.Notes)).ToList(),
            total, page, pageSize));
    }

    [HttpPost("adjust")]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<IActionResult> Adjust(StockAdjustmentRequest req)
    {
        if (!AllowedManualTypes.Contains(req.MovementType))
            return BadRequest(new { error = "Movement type not allowed for manual adjustment" });
        if (req.Quantity == 0) return BadRequest(new { error = "Quantity must not be zero" });

        var isIncrease = req.MovementType is InventoryMovementType.ADJUSTMENT_IN or InventoryMovementType.RETURN_IN;
        var signedQuantity = isIncrease ? Math.Abs(req.Quantity) : -Math.Abs(req.Quantity);

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            await _inventory.ApplyMovementAsync(req.ProductId, signedQuantity, req.MovementType,
                "ManualAdjustment", null, req.Reason);
            await _db.SaveChangesAsync();
            await _audit.LogAsync("STOCK_ADJUSTMENT", "Product", req.ProductId.ToString(),
                $"{req.MovementType}: {req.Quantity} - {req.Reason}");
            await tx.CommitAsync();
            return Ok(new { message = "Stock adjusted successfully" });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
