using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize(Roles = "Admin,Manager")]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ReportsController(ApplicationDbContext db)
    {
        _db = db;
    }

    private ActionResult RespondCsv<T>(List<T> rows, string filename, string? format)
    {
        if (format?.ToLower() == "csv")
        {
            var bytes = CsvExportService.ToCsv(rows);
            return File(bytes, "text/csv", filename);
        }
        return new OkObjectResult(rows);
    }

    [HttpGet("daily-sales")]
    public async Task<ActionResult> DailySales([FromQuery] DateTime? date, [FromQuery] string? format)
    {
        var day = (date ?? DateTime.UtcNow).Date;
        var next = day.AddDays(1);
        var orders = await _db.SalesOrders.Include(o => o.Customer)
            .Where(o => o.OrderDate >= day && o.OrderDate < next)
            .OrderBy(o => o.OrderDate)
            .Select(o => new SalesReportRow(o.OrderNumber, o.OrderDate, o.Customer!.BusinessName, o.Subtotal, o.Discount, o.GrandTotal, o.PaidAmount, o.RemainingAmount, o.Status.ToString(), o.PaymentStatus.ToString()))
            .ToListAsync();
        return RespondCsv(orders, $"daily-sales-{day:yyyy-MM-dd}.csv", format);
    }

    [HttpGet("monthly-sales")]
    public async Task<ActionResult> MonthlySales([FromQuery] int? year, [FromQuery] int? month, [FromQuery] string? format)
    {
        var y = year ?? DateTime.UtcNow.Year;
        var m = month ?? DateTime.UtcNow.Month;
        var start = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var orders = await _db.SalesOrders.Include(o => o.Customer)
            .Where(o => o.OrderDate >= start && o.OrderDate < end)
            .OrderBy(o => o.OrderDate)
            .Select(o => new SalesReportRow(o.OrderNumber, o.OrderDate, o.Customer!.BusinessName, o.Subtotal, o.Discount, o.GrandTotal, o.PaidAmount, o.RemainingAmount, o.Status.ToString(), o.PaymentStatus.ToString()))
            .ToListAsync();
        return RespondCsv(orders, $"monthly-sales-{y}-{m:D2}.csv", format);
    }

    [HttpGet("sales-by-customer")]
    public async Task<ActionResult> SalesByCustomer([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var query = _db.SalesOrders.Include(o => o.Customer).Where(o => o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft).AsQueryable();
        if (from.HasValue) query = query.Where(o => o.OrderDate >= from);
        if (to.HasValue) query = query.Where(o => o.OrderDate <= to);

        var orders = await query.ToListAsync();
        var rows = orders.GroupBy(o => o.Customer!.BusinessName)
            .Select(g => new SalesByCustomerRow(g.Key, g.Count(), g.Sum(x => x.GrandTotal), g.Sum(x => x.PaidAmount), g.Sum(x => x.RemainingAmount)))
            .OrderByDescending(r => r.TotalSales)
            .ToList();
        return RespondCsv(rows, "sales-by-customer.csv", format);
    }

    [HttpGet("sales-by-product")]
    public async Task<ActionResult> SalesByProduct([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var query = _db.SalesOrderItems.Include(i => i.Product).Include(i => i.SalesOrder)
            .Where(i => i.SalesOrder!.Status != SalesOrderStatus.Cancelled && i.SalesOrder.Status != SalesOrderStatus.Draft).AsQueryable();
        if (from.HasValue) query = query.Where(i => i.SalesOrder!.OrderDate >= from);
        if (to.HasValue) query = query.Where(i => i.SalesOrder!.OrderDate <= to);

        var items = await query.ToListAsync();
        var rows = items.GroupBy(i => i.Product!.Name)
            .Select(g => new SalesByProductRow(g.Key, g.Sum(x => x.Quantity), g.Sum(x => x.Total)))
            .OrderByDescending(r => r.Revenue)
            .ToList();
        return RespondCsv(rows, "sales-by-product.csv", format);
    }

    [HttpGet("purchases")]
    public async Task<ActionResult> Purchases([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? supplierId, [FromQuery] string? format)
    {
        var query = _db.Purchases.Include(p => p.Supplier).AsQueryable();
        if (from.HasValue) query = query.Where(p => p.PurchaseDate >= from);
        if (to.HasValue) query = query.Where(p => p.PurchaseDate <= to);
        if (supplierId.HasValue) query = query.Where(p => p.SupplierId == supplierId);

        var rows = await query.OrderByDescending(p => p.PurchaseDate)
            .Select(p => new PurchaseReportRow(p.PurchaseNumber, p.PurchaseDate, p.Supplier!.Name, p.TotalAmount, p.PaidAmount, p.RemainingAmount, p.Status.ToString()))
            .ToListAsync();
        return RespondCsv(rows, "purchases.csv", format);
    }

    [HttpGet("receivables")]
    public async Task<ActionResult> Receivables([FromQuery] string? format)
    {
        var rows = await _db.Customers.Where(c => c.CurrentBalance > 0)
            .OrderByDescending(c => c.CurrentBalance)
            .Select(c => new ReceivableRow(c.CustomerCode, c.BusinessName, c.Phone, c.CreditLimit, c.CurrentBalance))
            .ToListAsync();
        return RespondCsv(rows, "receivables.csv", format);
    }

    [HttpGet("payables")]
    public async Task<ActionResult> Payables([FromQuery] string? format)
    {
        var rows = await _db.Suppliers.Where(s => s.CurrentBalance > 0)
            .OrderByDescending(s => s.CurrentBalance)
            .Select(s => new PayableRow(s.SupplierCode, s.Name, s.Phone, s.CurrentBalance))
            .ToListAsync();
        return RespondCsv(rows, "payables.csv", format);
    }

    [HttpGet("inventory")]
    public async Task<ActionResult> Inventory([FromQuery] string? format)
    {
        var rows = await _db.Products.Include(p => p.Category).Where(p => p.IsActive)
            .OrderBy(p => p.Name)
            .Select(p => new InventoryReportRow(p.SKU, p.Name, p.Category!.Name, p.CurrentStock, p.Unit.ToString(), p.MinimumStock, p.CurrentStock * p.PurchasePrice, p.CurrentStock <= p.MinimumStock))
            .ToListAsync();
        return RespondCsv(rows, "inventory.csv", format);
    }

    [HttpGet("expenses")]
    public async Task<ActionResult> Expenses([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? categoryId, [FromQuery] string? format)
    {
        var query = _db.Expenses.Include(e => e.Category).AsQueryable();
        if (from.HasValue) query = query.Where(e => e.Date >= from);
        if (to.HasValue) query = query.Where(e => e.Date <= to);
        if (categoryId.HasValue) query = query.Where(e => e.CategoryId == categoryId);

        var rows = await query.OrderByDescending(e => e.Date)
            .Select(e => new ExpenseReportRow(e.Date, e.Category!.Name, e.Amount, e.PaidBy, e.PaymentMethod.ToString(), e.Description))
            .ToListAsync();
        return RespondCsv(rows, "expenses.csv", format);
    }

    [HttpGet("profit-summary")]
    public async Task<ActionResult<ProfitSummaryDto>> ProfitSummary([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = to ?? DateTime.UtcNow;

        var totalSales = await _db.SalesOrders.Where(o => o.OrderDate >= start && o.OrderDate <= end && o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft)
            .SumAsync(o => (decimal?)o.GrandTotal) ?? 0;
        var totalCogs = await _db.SalesOrderItems
            .Where(i => i.SalesOrder!.OrderDate >= start && i.SalesOrder.OrderDate <= end && i.SalesOrder.Status != SalesOrderStatus.Cancelled && i.SalesOrder.Status != SalesOrderStatus.Draft)
            .Join(_db.Products, i => i.ProductId, p => p.Id, (i, p) => i.Quantity * p.PurchasePrice)
            .SumAsync();
        var totalExpenses = await _db.Expenses.Where(e => e.Date >= start && e.Date <= end).SumAsync(e => (decimal?)e.Amount) ?? 0;
        var totalPurchases = await _db.Purchases.Where(p => p.PurchaseDate >= start && p.PurchaseDate <= end).SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
        var receivables = await _db.Customers.Where(c => c.CurrentBalance > 0).SumAsync(c => (decimal?)c.CurrentBalance) ?? 0;
        var payables = await _db.Suppliers.Where(s => s.CurrentBalance > 0).SumAsync(s => (decimal?)s.CurrentBalance) ?? 0;

        var grossProfit = totalSales - totalCogs;
        var netEstimated = grossProfit - totalExpenses;

        return Ok(new ProfitSummaryDto(totalSales, totalCogs, grossProfit, totalExpenses, netEstimated, totalPurchases, receivables, payables));
    }

    [HttpGet("payments")]
    public async Task<ActionResult> Payments([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var query = _db.Payments.Include(p => p.Customer).AsQueryable();
        if (from.HasValue) query = query.Where(p => p.PaymentDate >= from);
        if (to.HasValue) query = query.Where(p => p.PaymentDate <= to);

        var rows = await query.OrderByDescending(p => p.PaymentDate)
            .Select(p => new PaymentReportRow(p.PaymentNumber, p.PaymentDate, p.Customer!.BusinessName, p.Amount, p.Method.ToString(), p.Reference))
            .ToListAsync();
        return RespondCsv(rows, "payments.csv", format);
    }

    [HttpGet("deliveries")]
    public async Task<ActionResult> Deliveries([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] DeliveryStatus? status, [FromQuery] string? format)
    {
        var query = _db.Deliveries.Include(d => d.SalesOrder).Include(d => d.Customer).Include(d => d.DriverEmployee).AsQueryable();
        if (from.HasValue) query = query.Where(d => d.DeliveryDate >= from);
        if (to.HasValue) query = query.Where(d => d.DeliveryDate <= to);
        if (status.HasValue) query = query.Where(d => d.Status == status);

        var rows = await query.OrderByDescending(d => d.DeliveryDate)
            .Select(d => new DeliveryReportRow(d.SalesOrder!.OrderNumber, d.Customer!.BusinessName, d.DriverEmployee!.Name, d.Vehicle, d.DeliveryDate, d.Status.ToString()))
            .ToListAsync();
        return RespondCsv(rows, "deliveries.csv", format);
    }
}
