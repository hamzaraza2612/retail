using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Services;

public class InsufficientStockException : Exception
{
    public InsufficientStockException(string message) : base(message) { }
}

public class InventoryService
{
    private readonly ApplicationDbContext _db;
    private readonly CurrentUserService _currentUser;

    public InventoryService(ApplicationDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Applies a signed quantity delta to a product's stock and records the movement.
    /// The stock update is a single atomic conditional SQL statement (UPDATE ... WHERE
    /// current_stock + delta >= 0), so it is safe against two concurrent callers
    /// decrementing the same product at once: Postgres row-locks on UPDATE and
    /// re-evaluates the WHERE clause against the latest committed value, so only one of
    /// two concurrent oversell attempts can succeed. Must be called within a DB
    /// transaction owned by the caller alongside the related business record
    /// (purchase/sale/adjustment) so both commit or roll back together.
    /// </summary>
    public async Task ApplyMovementAsync(
        int productId,
        decimal signedQuantity,
        InventoryMovementType movementType,
        string referenceType,
        int? referenceId,
        string? notes = null,
        bool allowNegative = false,
        decimal? unitCost = null)
    {
        var query = _db.Products.Where(p => p.Id == productId);
        if (!allowNegative)
            query = query.Where(p => p.CurrentStock + signedQuantity >= 0);

        var affected = await query.ExecuteUpdateAsync(s => s
            .SetProperty(p => p.CurrentStock, p => p.CurrentStock + signedQuantity)
            .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));

        if (affected == 0)
        {
            var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId)
                ?? throw new InvalidOperationException($"Product {productId} not found");

            throw new InsufficientStockException(
                $"Insufficient stock for '{product.Name}'. Available: {product.CurrentStock} {product.Unit}, requested: {-signedQuantity} {product.Unit}.");
        }

        var current = await _db.Products.AsNoTracking().Where(p => p.Id == productId)
            .Select(p => new { p.CurrentStock, p.Unit }).FirstAsync();

        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId,
            MovementType = movementType,
            Quantity = Math.Abs(signedQuantity),
            Unit = current.Unit,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            StockAfter = current.CurrentStock,
            Date = DateTime.UtcNow,
            UserId = _currentUser.UserId == 0 ? 1 : _currentUser.UserId,
            Notes = notes,
            UnitCost = unitCost
        });
    }
}
