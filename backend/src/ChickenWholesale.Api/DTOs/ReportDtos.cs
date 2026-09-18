namespace ChickenWholesale.Api.DTOs;

public record SalesReportRow(string OrderNumber, DateTime OrderDate, string CustomerName, decimal Subtotal, decimal Discount, decimal GrandTotal, decimal Paid, decimal Remaining, string Status, string PaymentStatus);
public record SalesByCustomerRow(string CustomerName, int OrderCount, decimal TotalSales, decimal TotalPaid, decimal TotalOutstanding);
public record SalesByProductRow(string ProductName, decimal QuantitySold, decimal Revenue);
public record PurchaseReportRow(string PurchaseNumber, DateTime PurchaseDate, string SupplierName, decimal TotalAmount, decimal Paid, decimal Remaining, string Status);
public record ReceivableRow(string CustomerCode, string BusinessName, string Phone, decimal CreditLimit, decimal OutstandingBalance);
public record PayableRow(string SupplierCode, string Name, string Phone, decimal OutstandingBalance);
public record InventoryReportRow(string SKU, string ProductName, string Category, decimal CurrentStock, string Unit, decimal MinimumStock, decimal StockValue, bool LowStock);
public record ExpenseReportRow(DateTime Date, string Category, decimal Amount, string? PaidBy, string PaymentMethod, string? Description);
public record ProfitSummaryDto(decimal TotalSales, decimal TotalCogs, decimal GrossProfit, decimal TotalExpenses, decimal NetEstimatedProfit, decimal TotalPurchases, decimal OutstandingReceivables, decimal OutstandingPayables);
public record PaymentReportRow(string PaymentNumber, DateTime PaymentDate, string CustomerName, decimal Amount, string Method, string? Reference);
public record DeliveryReportRow(string OrderNumber, string CustomerName, string? DriverName, string? Vehicle, DateTime? DeliveryDate, string Status);
