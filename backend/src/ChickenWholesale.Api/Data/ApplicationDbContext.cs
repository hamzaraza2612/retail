using ChickenWholesale.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderItem> SalesOrderItems => Set<SalesOrderItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SupplierPayment> SupplierPayments => Set<SupplierPayment>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<ExpenseCategory> ExpenseCategories => Set<ExpenseCategory>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ProcessingBatch> ProcessingBatches => Set<ProcessingBatch>();
    public DbSet<ProcessingInput> ProcessingInputs => Set<ProcessingInput>();
    public DbSet<ProcessingOutput> ProcessingOutputs => Set<ProcessingOutput>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // ---- Sequences backing human-readable business identifiers (see CodeGeneratorService) ----
        b.HasSequence<long>("customer_code_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("supplier_code_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("purchase_number_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("order_number_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("invoice_number_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("payment_number_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("supplier_payment_number_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("employee_code_seq").StartsAt(1).IncrementsBy(1);
        b.HasSequence<long>("processing_batch_number_seq").StartsAt(1).IncrementsBy(1);

        // ---- Decimal precision (money = 18,2; quantities = 18,3) ----
        foreach (var entityType in b.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    var name = property.Name;
                    if (name.Contains("Quantity"))
                        property.SetColumnType("decimal(18,3)");
                    else
                        property.SetColumnType("decimal(18,2)");
                }
            }
        }

        // ---- Enums stored as strings for readability ----
        b.Entity<User>().Property(x => x.Role).HasConversion<string>();
        b.Entity<Customer>().Property(x => x.CustomerType).HasConversion<string>();
        b.Entity<Supplier>().Property(x => x.SupplierType).HasConversion<string>();
        b.Entity<Product>().Property(x => x.Unit).HasConversion<string>();
        b.Entity<Purchase>().Property(x => x.Status).HasConversion<string>();
        b.Entity<PurchaseItem>().Property(x => x.Unit).HasConversion<string>();
        b.Entity<InventoryTransaction>().Property(x => x.MovementType).HasConversion<string>();
        b.Entity<InventoryTransaction>().Property(x => x.Unit).HasConversion<string>();
        b.Entity<SalesOrder>().Property(x => x.Status).HasConversion<string>();
        b.Entity<SalesOrder>().Property(x => x.PaymentStatus).HasConversion<string>();
        b.Entity<SalesOrderItem>().Property(x => x.Unit).HasConversion<string>();
        b.Entity<Invoice>().Property(x => x.PaymentStatus).HasConversion<string>();
        b.Entity<Payment>().Property(x => x.Method).HasConversion<string>();
        b.Entity<SupplierPayment>().Property(x => x.Method).HasConversion<string>();
        b.Entity<Delivery>().Property(x => x.Status).HasConversion<string>();
        b.Entity<Employee>().Property(x => x.Status).HasConversion<string>();
        b.Entity<Expense>().Property(x => x.PaymentMethod).HasConversion<string>();
        b.Entity<Product>().Property(x => x.ProductType).HasConversion<string>();
        b.Entity<ProcessingBatch>().Property(x => x.Status).HasConversion<string>();
        b.Entity<ProcessingBatch>().Property(x => x.WasteUnit).HasConversion<string>();
        b.Entity<ProcessingInput>().Property(x => x.Unit).HasConversion<string>();
        b.Entity<ProcessingOutput>().Property(x => x.Unit).HasConversion<string>();

        // ---- Unique indexes ----
        b.Entity<User>().HasIndex(x => x.Username).IsUnique();
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Customer>().HasIndex(x => x.CustomerCode).IsUnique();
        b.Entity<Supplier>().HasIndex(x => x.SupplierCode).IsUnique();
        b.Entity<Product>().HasIndex(x => x.SKU).IsUnique();
        b.Entity<Purchase>().HasIndex(x => x.PurchaseNumber).IsUnique();
        b.Entity<SalesOrder>().HasIndex(x => x.OrderNumber).IsUnique();
        b.Entity<Invoice>().HasIndex(x => x.InvoiceNumber).IsUnique();
        b.Entity<Payment>().HasIndex(x => x.PaymentNumber).IsUnique();
        b.Entity<SupplierPayment>().HasIndex(x => x.PaymentNumber).IsUnique();
        b.Entity<Employee>().HasIndex(x => x.EmployeeCode).IsUnique();
        b.Entity<User>().HasIndex(x => x.EmployeeId).IsUnique();
        b.Entity<ProcessingBatch>().HasIndex(x => x.BatchNumber).IsUnique();

        // ---- Useful search indexes ----
        b.Entity<Customer>().HasIndex(x => x.BusinessName);
        b.Entity<Supplier>().HasIndex(x => x.Name);
        b.Entity<Product>().HasIndex(x => x.Name);
        b.Entity<InventoryTransaction>().HasIndex(x => new { x.ProductId, x.Date });
        b.Entity<SalesOrder>().HasIndex(x => x.OrderDate);
        b.Entity<Purchase>().HasIndex(x => x.PurchaseDate);
        b.Entity<AuditLog>().HasIndex(x => x.Timestamp);
        b.Entity<ProcessingBatch>().HasIndex(x => x.ProcessingDate);

        // ---- Relationships requiring Restrict to avoid multiple cascade paths ----
        b.Entity<PurchaseItem>()
            .HasOne(x => x.Purchase).WithMany(x => x.Items)
            .HasForeignKey(x => x.PurchaseId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PurchaseItem>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<SalesOrderItem>()
            .HasOne(x => x.SalesOrder).WithMany(x => x.Items)
            .HasForeignKey(x => x.SalesOrderId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SalesOrderItem>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Invoice>()
            .HasOne(x => x.SalesOrder).WithOne(x => x.Invoice)
            .HasForeignKey<Invoice>(x => x.SalesOrderId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Invoice>()
            .HasOne(x => x.Customer).WithMany(x => x.Invoices)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Payment>()
            .HasOne(x => x.Customer).WithMany(x => x.Payments)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Payment>()
            .HasOne(x => x.Invoice).WithMany()
            .HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<SupplierPayment>()
            .HasOne(x => x.Supplier).WithMany(x => x.SupplierPayments)
            .HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<SupplierPayment>()
            .HasOne(x => x.Purchase).WithMany()
            .HasForeignKey(x => x.PurchaseId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Purchase>()
            .HasOne(x => x.Supplier).WithMany(x => x.Purchases)
            .HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<SalesOrder>()
            .HasOne(x => x.Customer).WithMany(x => x.SalesOrders)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Delivery>()
            .HasOne(x => x.SalesOrder).WithOne(x => x.Delivery)
            .HasForeignKey<Delivery>(x => x.SalesOrderId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Delivery>()
            .HasOne(x => x.Customer).WithMany(x => x.Deliveries)
            .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Delivery>()
            .HasOne(x => x.DriverEmployee).WithMany(x => x.Deliveries)
            .HasForeignKey(x => x.DriverEmployeeId).OnDelete(DeleteBehavior.SetNull);

        b.Entity<InventoryTransaction>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Product>()
            .HasOne(x => x.Category).WithMany(x => x.Products)
            .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<Expense>()
            .HasOne(x => x.Category).WithMany(x => x.Expenses)
            .HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<User>()
            .HasOne(x => x.Employee).WithOne()
            .HasForeignKey<User>(x => x.EmployeeId).OnDelete(DeleteBehavior.SetNull);

        b.Entity<ProcessingInput>()
            .HasOne(x => x.ProcessingBatch).WithMany(x => x.Inputs)
            .HasForeignKey(x => x.ProcessingBatchId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ProcessingInput>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<ProcessingOutput>()
            .HasOne(x => x.ProcessingBatch).WithMany(x => x.Outputs)
            .HasForeignKey(x => x.ProcessingBatchId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ProcessingOutput>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
    }
}
