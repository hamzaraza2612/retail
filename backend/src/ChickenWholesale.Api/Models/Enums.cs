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
    RETURN_OUT
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
