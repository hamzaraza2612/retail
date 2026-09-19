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

    [HttpGet("processing")]
    public async Task<ActionResult> Processing([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var query = _db.ProcessingBatches.Include(b => b.Inputs).Include(b => b.Outputs).AsQueryable();
        if (from.HasValue) query = query.Where(b => b.ProcessingDate >= from);
        if (to.HasValue) query = query.Where(b => b.ProcessingDate <= to);

        var batches = await query.OrderByDescending(b => b.ProcessingDate).ToListAsync();
        var userNames = await _db.Users.ToDictionaryAsync(u => u.Id, u => u.FullName);

        var rows = batches.Select(b => new ProcessingReportRow(
            b.BatchNumber, b.ProcessingDate, b.Status.ToString(),
            b.Inputs.Sum(i => i.Quantity), b.Outputs.Sum(o => o.Quantity), b.WasteQuantity,
            b.Outputs.Sum(o => o.AllocatedCost),
            userNames.TryGetValue(b.CreatedByUserId, out var name) ? name : "Unknown"
        )).ToList();
        return RespondCsv(rows, "processing.csv", format);
    }

    [HttpGet("yield")]
    public async Task<ActionResult> Yield([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var query = _db.ProcessingBatches.Include(b => b.Inputs).Include(b => b.Outputs)
            .Where(b => b.Status == ProcessingBatchStatus.Completed).AsQueryable();
        if (from.HasValue) query = query.Where(b => b.ProcessingDate >= from);
        if (to.HasValue) query = query.Where(b => b.ProcessingDate <= to);

        var batches = await query.OrderByDescending(b => b.ProcessingDate).ToListAsync();
        var rows = batches.Select(b =>
        {
            var input = b.Inputs.Sum(i => i.Quantity);
            var usable = b.Outputs.Sum(o => o.Quantity);
            var yieldPct = input > 0 ? Math.Round(usable / input * 100, 2) : 0;
            return new YieldReportRow(b.BatchNumber, b.ProcessingDate, input, usable, b.WasteQuantity, yieldPct);
        }).ToList();
        return RespondCsv(rows, "yield.csv", format);
    }

    // Signed direction of each movement type for the daily-stock roll-forward below — the
    // same classification used to reconcile CurrentStock against the transaction ledger.
    private static decimal Signed(InventoryMovementType type, decimal qty) => type switch
    {
        InventoryMovementType.PURCHASE or InventoryMovementType.ADJUSTMENT_IN
            or InventoryMovementType.RETURN_IN or InventoryMovementType.PROCESSING_IN => qty,
        InventoryMovementType.SALE or InventoryMovementType.ADJUSTMENT_OUT or InventoryMovementType.WASTE
            or InventoryMovementType.RETURN_OUT or InventoryMovementType.PROCESSING_OUT => -qty,
        _ => 0
    };

    [HttpGet("daily-stock")]
    public async Task<ActionResult> DailyStock([FromQuery] DateTime? date, [FromQuery] string? format)
    {
        var day = (date ?? DateTime.UtcNow).Date;
        var dayEnd = day.AddDays(1);

        var products = await _db.Products.Include(p => p.Category).Where(p => p.IsActive).OrderBy(p => p.Name).ToListAsync();
        // CurrentStock is always the sum of every signed movement a product has ever had
        // (verified by the production-readiness audit's inventory reconciliation), so a
        // product's stock at the start of `day` is simply the sum of its movements
        // strictly before that day — no separate "opening balance" table needed, and this
        // works for any historical date, not just today.
        var movements = await _db.InventoryTransactions
            .Where(t => t.Date < dayEnd)
            .Select(t => new { t.ProductId, t.MovementType, t.Quantity, t.Date })
            .ToListAsync();

        var rows = products.Select(p =>
        {
            var forProduct = movements.Where(m => m.ProductId == p.Id).ToList();
            var opening = forProduct.Where(m => m.Date < day).Sum(m => Signed(m.MovementType, m.Quantity));
            var within = forProduct.Where(m => m.Date >= day).ToList();

            decimal Of(InventoryMovementType t) => within.Where(m => m.MovementType == t).Sum(m => m.Quantity);
            var closing = opening + within.Sum(m => Signed(m.MovementType, m.Quantity));

            return new DailyStockReportRow(
                p.SKU, p.Name, p.ProductType.ToString(), p.Unit.ToString(),
                opening, Of(InventoryMovementType.PURCHASE), Of(InventoryMovementType.PROCESSING_IN), Of(InventoryMovementType.PROCESSING_OUT),
                Of(InventoryMovementType.SALE), Of(InventoryMovementType.WASTE),
                Of(InventoryMovementType.ADJUSTMENT_IN), Of(InventoryMovementType.ADJUSTMENT_OUT),
                Of(InventoryMovementType.RETURN_IN), Of(InventoryMovementType.RETURN_OUT),
                closing
            );
        }).ToList();
        return RespondCsv(rows, $"daily-stock-{day:yyyy-MM-dd}.csv", format);
    }

    [HttpGet("product-profit")]
    public async Task<ActionResult> ProductProfit([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? format)
    {
        var start = from ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = to ?? DateTime.UtcNow;

        var items = await _db.SalesOrderItems.Include(i => i.Product).Include(i => i.SalesOrder)
            .Where(i => i.SalesOrder!.OrderDate >= start && i.SalesOrder.OrderDate <= end
                && i.SalesOrder.Status != SalesOrderStatus.Cancelled && i.SalesOrder.Status != SalesOrderStatus.Draft)
            .ToListAsync();

        // Historical cost per product, from the SALE movements' own UnitCost snapshot
        // rather than the product's current price — see InventoryTransaction.UnitCost.
        // Sales recorded before this field existed have no snapshot and cost 0 here; that
        // is a known limitation, not a bug (documented in BUSINESS_WORKFLOW.md).
        var costByProduct = await _db.InventoryTransactions
            .Where(t => t.MovementType == InventoryMovementType.SALE && t.Date >= start && t.Date <= end)
            .GroupBy(t => t.ProductId)
            .Select(g => new { ProductId = g.Key, Cost = g.Sum(t => t.Quantity * (t.UnitCost ?? 0)) })
            .ToDictionaryAsync(x => x.ProductId, x => x.Cost);

        var rows = items.GroupBy(i => new { i.ProductId, Name = i.Product!.Name })
            .Select(g =>
            {
                var qty = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.Total);
                var cost = costByProduct.TryGetValue(g.Key.ProductId, out var c) ? c : 0;
                return new ProductProfitReportRow(g.Key.Name, qty, qty > 0 ? Math.Round(revenue / qty, 2) : 0, revenue, cost, revenue - cost);
            })
            .OrderByDescending(r => r.Revenue)
            .ToList();
        return RespondCsv(rows, "product-profit.csv", format);
    }

    private async Task<int?> WalkInCustomerIdAsync() =>
        await _db.Customers.Where(c => c.CustomerCode == "CASH-001").Select(c => (int?)c.Id).FirstOrDefaultAsync();

    [HttpGet("daily-profit")]
    public async Task<ActionResult<DailyProfitDto>> DailyProfit([FromQuery] DateTime? date)
    {
        var day = (date ?? DateTime.UtcNow).Date;
        var dayEnd = day.AddDays(1);
        var walkInId = await WalkInCustomerIdAsync();

        var orders = await _db.SalesOrders
            .Where(o => o.OrderDate >= day && o.OrderDate < dayEnd && o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft)
            .Select(o => new { o.CustomerId, o.GrandTotal })
            .ToListAsync();

        var cashSales = orders.Where(o => walkInId.HasValue && o.CustomerId == walkInId).Sum(o => o.GrandTotal);
        var creditSales = orders.Where(o => !(walkInId.HasValue && o.CustomerId == walkInId)).Sum(o => o.GrandTotal);

        // COGS for stock that physically left today, by the movement's own timestamp —
        // see BUSINESS_WORKFLOW.md for why this can differ slightly from "orders placed
        // today" when an order is drafted one day and confirmed the next.
        var cogs = await _db.InventoryTransactions
            .Where(t => t.MovementType == InventoryMovementType.SALE && t.Date >= day && t.Date < dayEnd)
            .SumAsync(t => (decimal?)(t.Quantity * (t.UnitCost ?? 0))) ?? 0;

        var expenses = await _db.Expenses.Where(e => e.Date >= day && e.Date < dayEnd).SumAsync(e => (decimal?)e.Amount) ?? 0;

        var totalSales = cashSales + creditSales;
        var grossProfit = totalSales - cogs;
        var operating = grossProfit - expenses;

        return Ok(new DailyProfitDto(day, cashSales, creditSales, totalSales, cogs, grossProfit, expenses, operating));
    }

    [HttpGet("cash-vs-credit")]
    public async Task<ActionResult<CashVsCreditDto>> CashVsCredit([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var start = from ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = to ?? DateTime.UtcNow;
        var walkInId = await WalkInCustomerIdAsync();

        var orders = await _db.SalesOrders
            .Where(o => o.OrderDate >= start && o.OrderDate <= end && o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft)
            .Select(o => new { o.CustomerId, o.GrandTotal })
            .ToListAsync();

        var cash = orders.Where(o => walkInId.HasValue && o.CustomerId == walkInId).ToList();
        var credit = orders.Where(o => !(walkInId.HasValue && o.CustomerId == walkInId)).ToList();

        return Ok(new CashVsCreditDto(
            cash.Sum(o => o.GrandTotal), cash.Count,
            credit.Sum(o => o.GrandTotal), credit.Count,
            cash.Sum(o => o.GrandTotal) + credit.Sum(o => o.GrandTotal)
        ));
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
