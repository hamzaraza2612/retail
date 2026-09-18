using System.Security.Claims;
using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ChickenWholesale.Tests;

/// <summary>
/// Business logic tests run against a real, disposable PostgreSQL database rather than the
/// EF Core InMemory provider. This is a deliberate choice for this codebase: the audit's
/// concurrency fixes rely on ExecuteUpdateAsync compiling to real atomic SQL ("UPDATE ...
/// SET col = col + @delta WHERE ..."), which the InMemory provider cannot translate at all,
/// and even if it could, InMemory has no row-locking/isolation semantics — it could never
/// actually exercise the race conditions these tests are written to catch. Each test gets
/// its own throwaway Postgres database (created and dropped via the maintenance connection),
/// so tests stay fully isolated and can run in any order.
/// </summary>
public static class TestHelpers
{
    private const string MaintenanceConnectionString =
        "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=change-me-strong-password";

    private static string BuildConnectionString(string dbName) =>
        $"Host=localhost;Port=5432;Database={dbName};Username=postgres;Password=change-me-strong-password";

    /// <summary>Creates a fresh, isolated test database and returns a context connected to it.</summary>
    public static ApplicationDbContext CreateDb()
    {
        var dbName = "test_" + Guid.NewGuid().ToString("N");

        using (var conn = new NpgsqlConnection(MaintenanceConnectionString))
        {
            conn.Open();
            using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{dbName}\"", conn);
            cmd.ExecuteNonQuery();
        }

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(BuildConnectionString(dbName))
            .Options;
        var db = new ApplicationDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    /// <summary>
    /// Returns a second, independent DbContext pointed at the same database as an existing
    /// one — simulating a second worker's own request-scoped context for concurrency tests.
    /// </summary>
    public static ApplicationDbContext CreateSecondContext(ApplicationDbContext existing)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(existing.Database.GetConnectionString())
            .Options;
        return new ApplicationDbContext(options);
    }

    public static CurrentUserService CreateCurrentUser(int userId = 1, string userName = "testuser", string role = "Admin", int? employeeId = null)
    {
        var claimsList = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, userName),
            new(ClaimTypes.Role, role)
        };
        if (employeeId.HasValue) claimsList.Add(new Claim("employeeId", employeeId.Value.ToString()));

        var claims = new ClaimsIdentity(claimsList, "Test");
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(claims) };
        var accessor = new HttpContextAccessor { HttpContext = httpContext };
        return new CurrentUserService(accessor);
    }

    public static async Task<Employee> SeedEmployeeAsync(ApplicationDbContext db, string code, string name)
    {
        var employee = new Employee
        {
            EmployeeCode = code,
            Name = name,
            Phone = "0300-0000000",
            Role = "Driver",
            JoiningDate = DateTime.UtcNow,
            Salary = 30000,
            Status = EmployeeStatus.Active
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();
        return employee;
    }

    public static async Task<Product> SeedProductAsync(ApplicationDbContext db, decimal stock = 100, decimal minStock = 10)
    {
        var category = new ProductCategory { Name = "Boneless" };
        db.ProductCategories.Add(category);
        await db.SaveChangesAsync();

        var product = new Product
        {
            SKU = "BC-TEST",
            Name = "Boneless Chicken",
            CategoryId = category.Id,
            Unit = UnitOfMeasure.KG,
            PurchasePrice = 650,
            SalePrice = 750,
            MinimumStock = minStock,
            CurrentStock = stock,
            IsActive = true
        };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        return product;
    }

    public static async Task<Customer> SeedCustomerAsync(ApplicationDbContext db, decimal openingBalance = 0)
    {
        var customer = new Customer
        {
            CustomerCode = "CUST-TEST-1",
            BusinessName = "Test Restaurant",
            Phone = "0300-1234567",
            CustomerType = CustomerType.Restaurant,
            OpeningBalance = openingBalance,
            CurrentBalance = openingBalance,
            IsActive = true
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        return customer;
    }

    public static async Task<Supplier> SeedSupplierAsync(ApplicationDbContext db, decimal openingBalance = 0)
    {
        var supplier = new Supplier
        {
            SupplierCode = "SUPP-TEST-1",
            Name = "Test Supplier",
            Phone = "0300-7654321",
            SupplierType = SupplierType.LiveChicken,
            OpeningBalance = openingBalance,
            CurrentBalance = openingBalance,
            IsActive = true
        };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync();
        return supplier;
    }

    // Even against a real database, a DbContext caches entities it has already loaded in
    // its identity map, so re-reading through the SAME context used to perform an
    // ExecuteUpdateAsync (which bypasses the tracker) can return a stale instance. These
    // helpers always hit the store fresh, the way a new per-request DbContext would.
    public static Task<decimal> FreshStock(ApplicationDbContext db, int productId) =>
        db.Products.AsNoTracking().Where(p => p.Id == productId).Select(p => p.CurrentStock).FirstAsync();

    public static Task<Customer> FreshCustomer(ApplicationDbContext db, int customerId) =>
        db.Customers.AsNoTracking().FirstAsync(c => c.Id == customerId);

    public static Task<Supplier> FreshSupplier(ApplicationDbContext db, int supplierId) =>
        db.Suppliers.AsNoTracking().FirstAsync(s => s.Id == supplierId);

    public static Task<Invoice> FreshInvoice(ApplicationDbContext db, int invoiceId) =>
        db.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoiceId);

    public static Task<Purchase> FreshPurchase(ApplicationDbContext db, int purchaseId) =>
        db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchaseId);
}
