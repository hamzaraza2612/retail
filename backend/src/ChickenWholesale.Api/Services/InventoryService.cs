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
    /// Must be called within a DB transaction owned by the caller alongside the related
    /// business record (purchase/sale/adjustment) so both commit or roll back together.
    /// </summary>
    public async Task ApplyMovementAsync(
        int productId,
        decimal signedQuantity,
        InventoryMovementType movementType,
        string referenceType,
        int? referenceId,
        string? notes = null,
        bool allowNegative = false)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId)
            ?? throw new InvalidOperationException($"Product {productId} not found");

        var newStock = product.CurrentStock + signedQuantity;
        if (newStock < 0 && !allowNegative)
        {
            throw new InsufficientStockException(
                $"Insufficient stock for '{product.Name}'. Available: {product.CurrentStock} {product.Unit}, requested: {-signedQuantity} {product.Unit}.");
        }

        product.CurrentStock = newStock;
        product.UpdatedAt = DateTime.UtcNow;

        _db.InventoryTransactions.Add(new InventoryTransaction
        {
            ProductId = productId,
            MovementType = movementType,
            Quantity = Math.Abs(signedQuantity),
            Unit = product.Unit,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            StockAfter = newStock,
            Date = DateTime.UtcNow,
            UserId = _currentUser.UserId == 0 ? 1 : _currentUser.UserId,
            Notes = notes
        });
    }
}
