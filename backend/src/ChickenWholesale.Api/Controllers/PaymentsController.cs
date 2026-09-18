using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/payments")]
[Authorize(Roles = "Admin,Manager,Cashier,Sales")]
public class PaymentsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;
    private readonly CurrentUserService _currentUser;

    public PaymentsController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
        _currentUser = currentUser;
    }

    private static PaymentDto ToDto(Payment p) => new(
        p.Id, p.PaymentNumber, p.CustomerId, p.Customer?.BusinessName ?? "", p.InvoiceId, p.Invoice?.InvoiceNumber,
        p.Amount, p.PaymentDate, p.Method, p.Reference, p.Notes);

    [HttpGet]
    public async Task<ActionResult<PagedResult<PaymentDto>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Payments.Include(p => p.Customer).Include(p => p.Invoice).AsQueryable();
        if (customerId.HasValue) query = query.Where(p => p.CustomerId == customerId);
        if (from.HasValue) query = query.Where(p => p.PaymentDate >= from);
        if (to.HasValue) query = query.Where(p => p.PaymentDate <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.PaymentDate).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<PaymentDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<PaymentDto>> Create(CreatePaymentRequest req)
    {
        var customer = await _db.Customers.FindAsync(req.CustomerId);
        if (customer == null) return BadRequest(new { error = "Customer not found" });

        Invoice? invoice = null;
        if (req.InvoiceId.HasValue)
        {
            invoice = await _db.Invoices.Include(i => i.SalesOrder).FirstOrDefaultAsync(i => i.Id == req.InvoiceId);
            if (invoice == null) return BadRequest(new { error = "Invoice not found" });
            if (invoice.CustomerId != req.CustomerId) return BadRequest(new { error = "Invoice does not belong to this customer" });
            if (req.Amount > invoice.BalanceAmount)
                return BadRequest(new { error = $"Amount exceeds invoice balance of Rs. {invoice.BalanceAmount}" });
        }

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var payment = new Payment
            {
                PaymentNumber = await _codeGen.NextPaymentNumberAsync(),
                CustomerId = req.CustomerId,
                InvoiceId = req.InvoiceId,
                Amount = req.Amount,
                PaymentDate = req.PaymentDate ?? DateTime.UtcNow,
                Method = req.Method,
                Reference = req.Reference,
                Notes = req.Notes,
                CreatedByUserId = _currentUser.UserId
            };
            _db.Payments.Add(payment);

            customer.CurrentBalance -= req.Amount;
            customer.UpdatedAt = DateTime.UtcNow;

            if (invoice != null)
            {
                invoice.PaidAmount += req.Amount;
                invoice.BalanceAmount -= req.Amount;
                invoice.PaymentStatus = invoice.BalanceAmount <= 0 ? PaymentStatus.Paid
                    : (invoice.PaidAmount > 0 ? PaymentStatus.Partial : PaymentStatus.Unpaid);

                if (invoice.SalesOrder != null)
                {
                    invoice.SalesOrder.PaidAmount += req.Amount;
                    invoice.SalesOrder.RemainingAmount -= req.Amount;
                    invoice.SalesOrder.PaymentStatus = invoice.PaymentStatus;
                    invoice.SalesOrder.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync();
            await _audit.LogAsync("PAYMENT", "Customer", customer.Id.ToString(),
                $"Received Rs.{payment.Amount} from {customer.BusinessName} ({payment.Method})");
            await tx.CommitAsync();

            await _db.Entry(payment).Reference(p => p.Customer).LoadAsync();
            if (payment.InvoiceId.HasValue) await _db.Entry(payment).Reference(p => p.Invoice).LoadAsync();

            return Ok(ToDto(payment));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
