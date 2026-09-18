using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;

    public CustomersController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
    }

    private static CustomerDto ToDto(Customer c) => new(
        c.Id, c.CustomerCode, c.BusinessName, c.ContactPerson, c.Phone, c.WhatsApp, c.Address,
        c.City, c.CustomerType, c.CreditLimit, c.PaymentTerms, c.OpeningBalance, c.CurrentBalance,
        c.Notes, c.IsActive, c.CreatedAt);

    [HttpGet]
    public async Task<ActionResult<PagedResult<CustomerDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] CustomerType? type, [FromQuery] bool? active,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Customers.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c => c.BusinessName.Contains(search) || c.Phone.Contains(search) || c.CustomerCode.Contains(search));
        if (type.HasValue) query = query.Where(c => c.CustomerType == type);
        if (active.HasValue) query = query.Where(c => c.IsActive == active);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new PagedResult<CustomerDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CustomerDetailDto>> GetById(int id)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        var orders = await _db.SalesOrders.Where(o => o.CustomerId == id).ToListAsync();
        var totalPaid = await _db.Payments.Where(p => p.CustomerId == id).SumAsync(p => (decimal?)p.Amount) ?? 0;

        return Ok(new CustomerDetailDto(
            ToDto(customer),
            orders.Sum(o => o.GrandTotal),
            totalPaid,
            orders.OrderByDescending(o => o.OrderDate).FirstOrDefault()?.OrderDate,
            orders.Count
        ));
    }

    [HttpGet("{id}/orders")]
    public async Task<ActionResult> GetOrders(int id)
    {
        var orders = await _db.SalesOrders.Where(o => o.CustomerId == id)
            .OrderByDescending(o => o.OrderDate)
            .Select(o => new { o.Id, o.OrderNumber, o.OrderDate, o.Status, o.PaymentStatus, o.GrandTotal, o.PaidAmount, o.RemainingAmount })
            .ToListAsync();
        return Ok(orders);
    }

    [HttpGet("{id}/payments")]
    public async Task<ActionResult> GetPayments(int id)
    {
        var payments = await _db.Payments.Where(p => p.CustomerId == id)
            .OrderByDescending(p => p.PaymentDate)
            .Select(p => new { p.Id, p.PaymentNumber, p.PaymentDate, p.Amount, p.Method, p.Reference })
            .ToListAsync();
        return Ok(payments);
    }

    [HttpGet("{id}/statement")]
    public async Task<ActionResult> GetStatement(int id)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        var invoices = await _db.Invoices.Where(i => i.CustomerId == id)
            .Select(i => new { Type = "Invoice", Date = i.InvoiceDate, Reference = i.InvoiceNumber, Debit = i.GrandTotal, Credit = 0m })
            .ToListAsync();
        var payments = await _db.Payments.Where(p => p.CustomerId == id)
            .Select(p => new { Type = "Payment", Date = p.PaymentDate, Reference = p.PaymentNumber, Debit = 0m, Credit = p.Amount })
            .ToListAsync();

        var ledger = invoices.Concat(payments).OrderBy(x => x.Date).ToList();
        decimal running = customer.OpeningBalance;
        var rows = ledger.Select(l =>
        {
            running += l.Debit - l.Credit;
            return new { l.Type, l.Date, l.Reference, l.Debit, l.Credit, Balance = running };
        }).ToList();

        return Ok(new { customer.OpeningBalance, ClosingBalance = customer.CurrentBalance, Rows = rows });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Manager,Sales")]
    public async Task<ActionResult<CustomerDto>> Create(CreateCustomerRequest req)
    {
        var customer = new Customer
        {
            CustomerCode = await _codeGen.NextCustomerCodeAsync(),
            BusinessName = req.BusinessName,
            ContactPerson = req.ContactPerson,
            Phone = req.Phone,
            WhatsApp = req.WhatsApp,
            Address = req.Address,
            City = req.City,
            CustomerType = req.CustomerType,
            CreditLimit = req.CreditLimit,
            PaymentTerms = req.PaymentTerms,
            OpeningBalance = req.OpeningBalance,
            CurrentBalance = req.OpeningBalance,
            Notes = req.Notes,
            IsActive = true
        };
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Customer", customer.Id.ToString(), $"Created customer {customer.BusinessName}");
        return Ok(ToDto(customer));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Manager,Sales")]
    public async Task<ActionResult<CustomerDto>> Update(int id, UpdateCustomerRequest req)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();

        customer.BusinessName = req.BusinessName;
        customer.ContactPerson = req.ContactPerson;
        customer.Phone = req.Phone;
        customer.WhatsApp = req.WhatsApp;
        customer.Address = req.Address;
        customer.City = req.City;
        customer.CustomerType = req.CustomerType;
        customer.CreditLimit = req.CreditLimit;
        customer.PaymentTerms = req.PaymentTerms;
        customer.Notes = req.Notes;
        customer.IsActive = req.IsActive;
        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "Customer", customer.Id.ToString(), $"Updated customer {customer.BusinessName}");
        return Ok(ToDto(customer));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var customer = await _db.Customers.FindAsync(id);
        if (customer == null) return NotFound();
        customer.IsActive = false;
        customer.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DEACTIVATE", "Customer", customer.Id.ToString(), $"Deactivated customer {customer.BusinessName}");
        return Ok(new { message = "Customer deactivated" });
    }
}
