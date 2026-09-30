namespace ChickenWholesale.Api.Models;

public enum UserRole
{
    Admin,
    Manager,
    Sales,
    Cashier,
    StoreKeeper,
    Delivery
}

public enum UnitOfMeasure
{
    KG,
    Piece,
    Carton,
    Crate,
    Dozen,
    Custom
}

public enum CustomerType
{
    Restaurant,
    Hotel,
    Caterer,
    Shop,
    Wholesale,
    Individual,
    Other
}

public enum SupplierType
{
    LiveChicken,
    ChickenMeat,
    RawMaterial,
    Packaging,
    Other
}

public enum PurchaseStatus
{
    Confirmed,
    Cancelled
}

public enum InventoryMovementType
{
    PURCHASE,
    SALE,
    ADJUSTMENT_IN,
    ADJUSTMENT_OUT,
    WASTE,
    RETURN_IN,
    RETURN_OUT,
    // Raw material consumed as processing-batch input, and finished goods produced as
    // processing-batch output — kept distinct from PURCHASE/SALE so stock and yield
    // reports can tell "bought directly" apart from "produced by cutting/processing".
    PROCESSING_IN,
    PROCESSING_OUT
}

/// <summary>
/// Whether a product is consumed as processing input (RawMaterial) or is a sellable end
/// item (FinishedProduct, whether it was purchased directly or produced by a processing
/// batch — both are ordinary sellable stock once they exist). Existing products created
/// before this classification existed default to FinishedProduct (see migration
/// AddProcessingAndProductType) since they were already being purchased and sold directly.
/// </summary>
public enum ProductType
{
    RawMaterial,
    FinishedProduct
}

public enum ProcessingBatchStatus
{
    Draft,
    Completed,
    Cancelled
}

public enum SalesOrderStatus
{
    Draft,
    Confirmed,
    Processing,
    Ready,
    OutForDelivery,
    Delivered,
    Cancelled
}

public enum PaymentStatus
{
    Unpaid,
    Partial,
    Paid
}

public enum PaymentMethod
{
    Cash,
    BankTransfer,
    OnlineTransfer,
    Cheque,
    Other
}

public enum DeliveryStatus
{
    Pending,
    Assigned,
    OutForDelivery,
    Delivered,
    Failed,
    Cancelled
}

public enum EmployeeStatus
{
    Active,
    Inactive
}
