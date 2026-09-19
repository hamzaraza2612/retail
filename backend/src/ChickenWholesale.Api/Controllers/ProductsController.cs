using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;

    public ProductsController(ApplicationDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static ProductDto ToDto(Product p) => new(
        p.Id, p.SKU, p.Name, p.CategoryId, p.Category?.Name ?? "", p.Unit, p.PurchasePrice,
        p.SalePrice, p.MinimumStock, p.CurrentStock, p.Description, p.IsActive, p.CreatedAt, p.UpdatedAt, p.ProductType);

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] int? categoryId, [FromQuery] bool? active,
        [FromQuery] bool? lowStock, [FromQuery] ProductType? productType,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _db.Products.Include(p => p.Category).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => p.Name.Contains(search) || p.SKU.Contains(search));
        if (categoryId.HasValue) query = query.Where(p => p.CategoryId == categoryId);
        if (active.HasValue) query = query.Where(p => p.IsActive == active);
        if (lowStock == true) query = query.Where(p => p.CurrentStock <= p.MinimumStock);
        if (productType.HasValue) query = query.Where(p => p.ProductType == productType);

        var total = await query.CountAsync();
        var items = await query.OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<ProductDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("categories")]
    public async Task<ActionResult<List<ProductCategoryDto>>> GetCategories()
    {
        var cats = await _db.ProductCategories.OrderBy(c => c.Name).ToListAsync();
        return Ok(cats.Select(c => new ProductCategoryDto(c.Id, c.Name)));
    }

    [HttpPost("categories")]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<ActionResult<ProductCategoryDto>> CreateCategory([FromBody] string name)
    {
        var cat = new ProductCategory { Name = name };
        _db.ProductCategories.Add(cat);
        await _db.SaveChangesAsync();
        return Ok(new ProductCategoryDto(cat.Id, cat.Name));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> GetById(int id)
    {
        var product = await _db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
        return product == null ? NotFound() : Ok(ToDto(product));
    }

    [HttpGet("{id}/movements")]
    public async Task<ActionResult> GetMovements(int id)
    {
        var movements = await _db.InventoryTransactions.Where(m => m.ProductId == id)
            .OrderByDescending(m => m.Date)
            .Take(100)
            .Select(m => new { m.Id, m.MovementType, m.Quantity, m.Unit, m.ReferenceType, m.ReferenceId, m.StockAfter, m.Date, m.Notes })
            .ToListAsync();
        return Ok(movements);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<ActionResult<ProductDto>> Create(CreateProductRequest req)
    {
        if (await _db.Products.AnyAsync(p => p.SKU == req.SKU))
            return BadRequest(new { error = "SKU already exists" });

        var product = new Product
        {
            SKU = req.SKU,
            Name = req.Name,
            CategoryId = req.CategoryId,
            Unit = req.Unit,
            PurchasePrice = req.PurchasePrice,
            SalePrice = req.SalePrice,
            MinimumStock = req.MinimumStock,
            CurrentStock = 0,
            Description = req.Description,
            IsActive = true,
            ProductType = req.ProductType
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Product", product.Id.ToString(), $"Created product {product.Name}");
        await _db.Entry(product).Reference(p => p.Category).LoadAsync();
        return Ok(ToDto(product));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager,StoreKeeper")]
    public async Task<ActionResult<ProductDto>> Update(int id, UpdateProductRequest req)
    {
        var product = await _db.Products.Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound();

        product.Name = req.Name;
        product.CategoryId = req.CategoryId;
        product.Unit = req.Unit;
        product.PurchasePrice = req.PurchasePrice;
        product.SalePrice = req.SalePrice;
        product.MinimumStock = req.MinimumStock;
        product.Description = req.Description;
        product.IsActive = req.IsActive;
        product.ProductType = req.ProductType;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "Product", product.Id.ToString(), $"Updated product {product.Name}");
        await _db.Entry(product).Reference(p => p.Category).LoadAsync();
        return Ok(ToDto(product));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product == null) return NotFound();
        product.IsActive = false;
        product.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DEACTIVATE", "Product", product.Id.ToString(), $"Deactivated product {product.Name}");
        return Ok(new { message = "Product deactivated" });
    }
}
