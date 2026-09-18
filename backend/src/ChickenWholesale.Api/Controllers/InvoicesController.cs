using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public class InvoicesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public InvoicesController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<InvoiceDto>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Invoices.Include(i => i.Customer).Include(i => i.SalesOrder).ThenInclude(o => o!.Items).ThenInclude(x => x.Product).AsQueryable();
        if (customerId.HasValue) query = query.Where(i => i.CustomerId == customerId);
        if (from.HasValue) query = query.Where(i => i.InvoiceDate >= from);
        if (to.HasValue) query = query.Where(i => i.InvoiceDate <= to);

        var total = await query.CountAsync();
        var invoices = await query.OrderByDescending(i => i.InvoiceDate).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = invoices.Select(ToDto).ToList();
        return Ok(new PagedResult<InvoiceDto>(dtos, total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InvoiceDto>> GetById(int id)
    {
        var invoice = await _db.Invoices.Include(i => i.Customer).Include(i => i.SalesOrder).ThenInclude(o => o!.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(i => i.Id == id);
        return invoice == null ? NotFound() : Ok(ToDto(invoice));
    }

    private static InvoiceDto ToDto(Models.Invoice i) => new(
        i.Id, i.InvoiceNumber, i.SalesOrderId, i.SalesOrder?.OrderNumber ?? "", i.CustomerId,
        i.Customer?.BusinessName ?? "", i.Customer?.Phone, i.Customer?.Address, i.InvoiceDate,
        i.Subtotal, i.Discount, i.DeliveryCharges, i.GrandTotal, i.PaidAmount, i.BalanceAmount, i.PaymentStatus,
        i.SalesOrder?.Items.Select(x => new SalesOrderItemDto(x.Id, x.ProductId, x.Product?.Name ?? "", x.Quantity, x.Unit, x.Rate, x.Total)).ToList()
            ?? new List<SalesOrderItemDto>()
    );
}
