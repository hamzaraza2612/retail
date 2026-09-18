namespace ChickenWholesale.Api.DTOs;

public record DashboardCardsDto(
    decimal TodaySales, int TodayOrders, decimal TodayPurchases, decimal TodayExpenses,
    decimal TotalReceivables, decimal TotalPayables, decimal StockValue, decimal EstimatedGrossProfitThisMonth
);

public record DailyPointDto(string Date, decimal Value);
public record CategoryAmountDto(string Category, decimal Amount);
public record TopProductDto(string ProductName, decimal QuantitySold, decimal Revenue);

public record RecentOrderDto(int Id, string OrderNumber, string CustomerName, decimal GrandTotal, string Status, string PaymentStatus, DateTime OrderDate);
public record PendingDeliveryDto(int Id, string OrderNumber, string CustomerName, string? DriverName, string Status, DateTime? DeliveryDate);
public record LowStockItemDto(int Id, string Name, decimal CurrentStock, decimal MinimumStock, string Unit);
public record RecentPaymentDto(int Id, string PaymentNumber, string CustomerName, decimal Amount, DateTime PaymentDate, string Method);

public record DashboardDto(
    DashboardCardsDto Cards,
    List<DailyPointDto> SalesLast7Days,
    List<DailyPointDto> OrdersLast7Days,
    List<CategoryAmountDto> ExpensesByCategory,
    List<TopProductDto> TopSellingProducts,
    List<RecentOrderDto> RecentOrders,
    List<PendingDeliveryDto> PendingDeliveries,
    List<LowStockItemDto> LowStockProducts,
    List<RecentPaymentDto> RecentPayments
);
