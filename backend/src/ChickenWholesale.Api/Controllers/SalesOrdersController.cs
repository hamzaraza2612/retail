using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class SalesOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;
    private readonly InventoryService _inventory;
    private readonly CurrentUserService _currentUser;

    public SalesOrdersController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen,
        InventoryService inventory, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
        _inventory = inventory;
        _currentUser = currentUser;
    }

    private static SalesOrderDto ToDto(SalesOrder o) => new(
        o.Id, o.OrderNumber, o.CustomerId, o.Customer?.BusinessName ?? "", o.OrderDate, o.DeliveryDate,
        o.Subtotal, o.Discount, o.DeliveryCharges, o.GrandTotal, o.PaidAmount, o.RemainingAmount,
        o.Status, o.PaymentStatus, o.Notes, o.CreatedAt,
        o.Items.Select(i => new SalesOrderItemDto(i.Id, i.ProductId, i.Product?.Name ?? "", i.Quantity, i.Unit, i.Rate, i.Total)).ToList()
    );

    [HttpGet]
    public async Task<ActionResult<PagedResult<SalesOrderDto>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] SalesOrderStatus? status, [FromQuery] PaymentStatus? paymentStatus,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.SalesOrders.Include(o => o.Customer).Include(o => o.Items).ThenInclude(i => i.Product).AsQueryable();
        if (customerId.HasValue) query = query.Where(o => o.CustomerId == customerId);
        if (status.HasValue) query = query.Where(o => o.Status == status);
        if (paymentStatus.HasValue) query = query.Where(o => o.PaymentStatus == paymentStatus);
        if (from.HasValue) query = query.Where(o => o.OrderDate >= from);
        if (to.HasValue) query = query.Where(o => o.OrderDate <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(o => o.OrderDate)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<SalesOrderDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SalesOrderDto>> GetById(int id)
    {
        var order = await _db.SalesOrders.Include(o => o.Customer).Include(o => o.Items).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == id);
        return order == null ? NotFound() : Ok(ToDto(order));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Sales")]
    public async Task<ActionResult<SalesOrderDto>> Create(CreateSalesOrderRequest req)
    {
        var customer = await _db.Customers.FindAsync(req.CustomerId);
        if (customer == null) return BadRequest(new { error = "Customer not found" });

        var order = new SalesOrder
        {
            OrderNumber = await _codeGen.NextOrderNumberAsync(),
            CustomerId = req.CustomerId,
            OrderDate = req.OrderDate ?? DateTime.UtcNow,
            DeliveryDate = req.DeliveryDate,
            Status = SalesOrderStatus.Draft,
            CreatedByUserId = _currentUser.UserId,
            Notes = req.Notes
        };

        decimal subtotal = 0;
        foreach (var itemReq in req.Items)
        {
            var product = await _db.Products.FindAsync(itemReq.ProductId);
            if (product == null) return BadRequest(new { error = $"Product {itemReq.ProductId} not found" });

            var total = itemReq.Quantity * itemReq.Rate;
            subtotal += total;
            order.Items.Add(new SalesOrderItem
            {
                ProductId = product.Id,
                Quantity = itemReq.Quantity,
                Unit = product.Unit,
                Rate = itemReq.Rate,
                Total = total
            });
        }

        if (req.Discount > subtotal) return BadRequest(new { error = "Discount cannot exceed subtotal" });

        var grandTotal = subtotal - req.Discount + req.DeliveryCharges;
        if (req.PaidAmount > grandTotal) return BadRequest(new { error = "Paid amount cannot exceed grand total" });

        order.Subtotal = subtotal;
        order.Discount = req.Discount;
        order.DeliveryCharges = req.DeliveryCharges;
        order.GrandTotal = grandTotal;
        order.PaidAmount = req.PaidAmount;
        order.RemainingAmount = grandTotal - req.PaidAmount;
        order.PaymentStatus = order.RemainingAmount <= 0 ? PaymentStatus.Paid
            : (order.PaidAmount > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid);

        _db.SalesOrders.Add(order);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "SalesOrder", order.Id.ToString(), $"Created order {order.OrderNumber} for {customer.BusinessName}");

        await _db.Entry(order).Reference(o => o.Customer).LoadAsync();
        foreach (var i in order.Items) await _db.Entry(i).Reference(x => x.Product).LoadAsync();
        return Ok(ToDto(order));
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,Manager,Sales,StoreKeeper")]
    public async Task<ActionResult<SalesOrderDto>> UpdateStatus(int id, UpdateOrderStatusRequest req)
    {
        var order = await _db.SalesOrders.Include(o => o.Customer).Include(o => o.Items).ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        if (order.Status == SalesOrderStatus.Cancelled)
            return BadRequest(new { error = "Cannot change status of a cancelled order" });
        if (order.Status == SalesOrderStatus.Delivered && req.Status != SalesOrderStatus.Delivered)
            return BadRequest(new { error = "Cannot change status of a delivered order" });

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            if (req.Status == SalesOrderStatus.Cancelled)
            {
                if (order.StockDeducted)
                {
                    foreach (var item in order.Items)
                    {
                        await _inventory.ApplyMovementAsync(item.ProductId, item.Quantity, InventoryMovementType.RETURN_IN,
                            "SalesOrderCancel", order.Id, $"Order {order.OrderNumber} cancelled");
                    }
                    order.Customer!.CurrentBalance -= order.RemainingAmount;
                    order.Customer.UpdatedAt = DateTime.UtcNow;
                    order.StockDeducted = false;
                }
                order.Status = SalesOrderStatus.Cancelled;
            }
            else if (req.Status == SalesOrderStatus.Confirmed && order.Status == SalesOrderStatus.Draft)
            {
                if (!order.StockDeducted)
                {
                    foreach (var item in order.Items)
                    {
                        await _inventory.ApplyMovementAsync(item.ProductId, -item.Quantity, InventoryMovementType.SALE,
                            "SalesOrder", order.Id, $"Order {order.OrderNumber}", allowNegative: false);
                    }

                    var invoice = new Invoice
                    {
                        InvoiceNumber = await _codeGen.NextInvoiceNumberAsync(),
                        SalesOrderId = order.Id,
                        CustomerId = order.CustomerId,
                        InvoiceDate = order.OrderDate,
                        Subtotal = order.Subtotal,
                        Discount = order.Discount,
                        DeliveryCharges = order.DeliveryCharges,
                        GrandTotal = order.GrandTotal,
                        PaidAmount = order.PaidAmount,
                        BalanceAmount = order.RemainingAmount,
                        PaymentStatus = order.PaymentStatus
                    };
                    _db.Invoices.Add(invoice);

                    order.Customer!.CurrentBalance += order.RemainingAmount;
                    order.Customer.UpdatedAt = DateTime.UtcNow;
                    order.StockDeducted = true;
                }
                order.Status = SalesOrderStatus.Confirmed;
            }
            else
            {
                order.Status = req.Status;
            }

            order.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _audit.LogAsync("STATUS_CHANGE", "SalesOrder", order.Id.ToString(),
                $"Order {order.OrderNumber} status -> {req.Status}");
            await tx.CommitAsync();

            return Ok(ToDto(order));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
