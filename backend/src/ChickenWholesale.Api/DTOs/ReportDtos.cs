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

// ---- Processing / Yield ----
public record ProcessingReportRow(
    string BatchNumber, DateTime ProcessingDate, string Status,
    decimal TotalInputQuantity, decimal TotalOutputQuantity, decimal WasteQuantity, decimal TotalAllocatedCost, string CreatedBy
);

public record YieldReportRow(
    string BatchNumber, DateTime ProcessingDate,
    decimal InputQuantity, decimal UsableOutputQuantity, decimal WasteQuantity, decimal YieldPercent
);

// ---- Daily stock (per-product roll-forward for a single date, from the inventory
// transaction ledger — see BUSINESS_WORKFLOW.md "Daily Stock Report") ----
public record DailyStockReportRow(
    string SKU, string ProductName, string ProductType, string Unit,
    decimal Opening, decimal Purchased, decimal ProcessedIn, decimal ProcessedOut,
    decimal Sold, decimal Waste, decimal AdjustmentIn, decimal AdjustmentOut,
    decimal ReturnIn, decimal ReturnOut, decimal Closing
);

// ---- Product-wise profit, using the historical cost snapshot on each SALE inventory
// movement (InventoryTransaction.UnitCost) rather than the product's current price, so
// this stays correct even after a later processing batch changes the product's cost. ----
public record ProductProfitReportRow(
    string ProductName, decimal SoldQuantity, decimal AverageRate, decimal Revenue,
    decimal EstimatedCost, decimal GrossProfit
);

// ---- Daily profit/loss (section 14). EstimatedCogs is explicitly an estimate — see
// BUSINESS_WORKFLOW.md for exactly what it does and doesn't account for. ----
public record DailyProfitDto(
    DateTime Date, decimal CashSales, decimal CreditSales, decimal TotalSales,
    decimal EstimatedCogs, decimal GrossProfit, decimal Expenses, decimal OperatingProfitLoss
);

public record CashVsCreditDto(
    decimal CashSales, int CashOrderCount, decimal CreditSales, int CreditOrderCount, decimal TotalSales
);
