using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/deliveries")]
[Authorize]
public class DeliveriesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;

    public DeliveriesController(ApplicationDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static DeliveryDto ToDto(Delivery d) => new(
        d.Id, d.SalesOrderId, d.SalesOrder?.OrderNumber ?? "", d.CustomerId, d.Customer?.BusinessName ?? "",
        d.DeliveryAddress, d.DriverEmployeeId, d.DriverEmployee?.Name, d.Vehicle, d.DeliveryDate, d.DeliveryTime,
        d.Status, d.Notes, d.CreatedAt);

    [HttpGet]
    public async Task<ActionResult<PagedResult<DeliveryDto>>> GetAll(
        [FromQuery] DeliveryStatus? status, [FromQuery] int? driverEmployeeId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Deliveries.Include(d => d.SalesOrder).Include(d => d.Customer).Include(d => d.DriverEmployee).AsQueryable();
        if (status.HasValue) query = query.Where(d => d.Status == status);
        if (driverEmployeeId.HasValue) query = query.Where(d => d.DriverEmployeeId == driverEmployeeId);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(d => d.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<DeliveryDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Sales,StoreKeeper")]
    public async Task<ActionResult<DeliveryDto>> Create(CreateDeliveryRequest req)
    {
        var order = await _db.SalesOrders.FindAsync(req.SalesOrderId);
        if (order == null) return BadRequest(new { error = "Sales order not found" });
        if (await _db.Deliveries.AnyAsync(d => d.SalesOrderId == req.SalesOrderId))
            return BadRequest(new { error = "A delivery already exists for this order" });

        var delivery = new Delivery
        {
            SalesOrderId = req.SalesOrderId,
            CustomerId = order.CustomerId,
            DeliveryAddress = req.DeliveryAddress,
            DriverEmployeeId = req.DriverEmployeeId,
            Vehicle = req.Vehicle,
            DeliveryDate = req.DeliveryDate,
            DeliveryTime = req.DeliveryTime,
            Status = req.DriverEmployeeId.HasValue ? DeliveryStatus.Assigned : DeliveryStatus.Pending,
            Notes = req.Notes
        };
        _db.Deliveries.Add(delivery);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Delivery", delivery.Id.ToString(), $"Created delivery for order {order.OrderNumber}");

        await _db.Entry(delivery).Reference(d => d.SalesOrder).LoadAsync();
        await _db.Entry(delivery).Reference(d => d.Customer).LoadAsync();
        if (delivery.DriverEmployeeId.HasValue) await _db.Entry(delivery).Reference(d => d.DriverEmployee).LoadAsync();
        return Ok(ToDto(delivery));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager,Sales,StoreKeeper")]
    public async Task<ActionResult<DeliveryDto>> Update(int id, UpdateDeliveryRequest req)
    {
        var delivery = await _db.Deliveries.Include(d => d.SalesOrder).Include(d => d.Customer).Include(d => d.DriverEmployee)
            .FirstOrDefaultAsync(d => d.Id == id);
        if (delivery == null) return NotFound();

        delivery.DriverEmployeeId = req.DriverEmployeeId;
        delivery.Vehicle = req.Vehicle;
        delivery.DeliveryDate = req.DeliveryDate;
        delivery.DeliveryTime = req.DeliveryTime;
        delivery.DeliveryAddress = req.DeliveryAddress;
        delivery.Notes = req.Notes;
        if (delivery.Status == DeliveryStatus.Pending && req.DriverEmployeeId.HasValue)
            delivery.Status = DeliveryStatus.Assigned;
        delivery.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _db.Entry(delivery).Reference(d => d.DriverEmployee).LoadAsync();
        await _audit.LogAsync("UPDATE", "Delivery", delivery.Id.ToString(), "Updated delivery details");
        return Ok(ToDto(delivery));
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,Manager,Sales,StoreKeeper,Delivery")]
    public async Task<ActionResult<DeliveryDto>> UpdateStatus(int id, UpdateDeliveryStatusRequest req)
    {
        var delivery = await _db.Deliveries.Include(d => d.SalesOrder).Include(d => d.Customer).Include(d => d.DriverEmployee)
            .FirstOrDefaultAsync(d => d.Id == id);
        if (delivery == null) return NotFound();

        delivery.Status = req.Status;
        if (!string.IsNullOrWhiteSpace(req.Notes)) delivery.Notes = req.Notes;
        delivery.UpdatedAt = DateTime.UtcNow;

        if (req.Status == DeliveryStatus.Delivered && delivery.SalesOrder != null
            && delivery.SalesOrder.Status is SalesOrderStatus.Confirmed or SalesOrderStatus.Processing or SalesOrderStatus.Ready or SalesOrderStatus.OutForDelivery)
        {
            delivery.SalesOrder.Status = SalesOrderStatus.Delivered;
            delivery.SalesOrder.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("STATUS_CHANGE", "Delivery", delivery.Id.ToString(), $"Delivery status -> {req.Status}");
        return Ok(ToDto(delivery));
    }
}
