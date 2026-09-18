using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public DashboardController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);
        var monthStart = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var todaySales = await _db.SalesOrders
            .Where(o => o.OrderDate >= today && o.OrderDate < tomorrow && o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft)
            .SumAsync(o => (decimal?)o.GrandTotal) ?? 0;
        var todayOrders = await _db.SalesOrders.CountAsync(o => o.OrderDate >= today && o.OrderDate < tomorrow);
        var todayPurchases = await _db.Purchases
            .Where(p => p.PurchaseDate >= today && p.PurchaseDate < tomorrow)
            .SumAsync(p => (decimal?)p.TotalAmount) ?? 0;
        var todayExpenses = await _db.Expenses
            .Where(e => e.Date >= today && e.Date < tomorrow)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;

        var totalReceivables = await _db.Customers.Where(c => c.CurrentBalance > 0).SumAsync(c => (decimal?)c.CurrentBalance) ?? 0;
        var totalPayables = await _db.Suppliers.Where(s => s.CurrentBalance > 0).SumAsync(s => (decimal?)s.CurrentBalance) ?? 0;
        var stockValue = await _db.Products.Where(p => p.IsActive).SumAsync(p => (decimal?)(p.CurrentStock * p.PurchasePrice)) ?? 0;

        var monthRevenue = await _db.Invoices.Where(i => i.InvoiceDate >= monthStart).SumAsync(i => (decimal?)i.GrandTotal) ?? 0;
        var monthCogs = await _db.SalesOrderItems
            .Where(i => i.SalesOrder!.StockDeducted && i.SalesOrder.OrderDate >= monthStart)
            .Join(_db.Products, i => i.ProductId, p => p.Id, (i, p) => i.Quantity * p.PurchasePrice)
            .SumAsync();
        var estimatedGrossProfit = monthRevenue - monthCogs;

        var salesLast7Days = new List<DailyPointDto>();
        var ordersLast7Days = new List<DailyPointDto>();
        for (int i = 6; i >= 0; i--)
        {
            var day = today.AddDays(-i);
            var next = day.AddDays(1);
            var sales = await _db.SalesOrders.Where(o => o.OrderDate >= day && o.OrderDate < next && o.Status != SalesOrderStatus.Cancelled && o.Status != SalesOrderStatus.Draft)
                .SumAsync(o => (decimal?)o.GrandTotal) ?? 0;
            var count = await _db.SalesOrders.CountAsync(o => o.OrderDate >= day && o.OrderDate < next);
            salesLast7Days.Add(new DailyPointDto(day.ToString("yyyy-MM-dd"), sales));
            ordersLast7Days.Add(new DailyPointDto(day.ToString("yyyy-MM-dd"), count));
        }

        var expensesByCategory = await _db.Expenses.Where(e => e.Date >= monthStart)
            .Include(e => e.Category)
            .GroupBy(e => e.Category!.Name)
            .Select(g => new CategoryAmountDto(g.Key, g.Sum(x => x.Amount)))
            .ToListAsync();

        var soldItems = await _db.SalesOrderItems.Include(i => i.Product).Include(i => i.SalesOrder)
            .Where(i => i.SalesOrder!.Status != SalesOrderStatus.Cancelled && i.SalesOrder.Status != SalesOrderStatus.Draft)
            .ToListAsync();
        var topProducts = soldItems.GroupBy(i => i.Product!.Name)
            .Select(g => new TopProductDto(g.Key, g.Sum(x => x.Quantity), g.Sum(x => x.Total)))
            .OrderByDescending(x => x.Revenue)
            .Take(5)
            .ToList();

        var recentOrders = await _db.SalesOrders.Include(o => o.Customer)
            .OrderByDescending(o => o.CreatedAt).Take(10)
            .Select(o => new RecentOrderDto(o.Id, o.OrderNumber, o.Customer!.BusinessName, o.GrandTotal, o.Status.ToString(), o.PaymentStatus.ToString(), o.OrderDate))
            .ToListAsync();

        var pendingDeliveries = await _db.Deliveries.Include(d => d.SalesOrder).Include(d => d.Customer).Include(d => d.DriverEmployee)
            .Where(d => d.Status != DeliveryStatus.Delivered && d.Status != DeliveryStatus.Cancelled)
            .OrderBy(d => d.DeliveryDate)
            .Take(10)
            .Select(d => new PendingDeliveryDto(d.Id, d.SalesOrder!.OrderNumber, d.Customer!.BusinessName, d.DriverEmployee!.Name, d.Status.ToString(), d.DeliveryDate))
            .ToListAsync();

        var lowStock = await _db.Products.Where(p => p.IsActive && p.CurrentStock <= p.MinimumStock)
            .OrderBy(p => p.CurrentStock)
            .Take(10)
            .Select(p => new LowStockItemDto(p.Id, p.Name, p.CurrentStock, p.MinimumStock, p.Unit.ToString()))
            .ToListAsync();

        var recentPayments = await _db.Payments.Include(p => p.Customer)
            .OrderByDescending(p => p.CreatedAt).Take(10)
            .Select(p => new RecentPaymentDto(p.Id, p.PaymentNumber, p.Customer!.BusinessName, p.Amount, p.PaymentDate, p.Method.ToString()))
            .ToListAsync();

        var cards = new DashboardCardsDto(todaySales, todayOrders, todayPurchases, todayExpenses,
            totalReceivables, totalPayables, stockValue, estimatedGrossProfit);

        return Ok(new DashboardDto(cards, salesLast7Days, ordersLast7Days, expensesByCategory, topProducts,
            recentOrders, pendingDeliveries, lowStock, recentPayments));
    }
}
