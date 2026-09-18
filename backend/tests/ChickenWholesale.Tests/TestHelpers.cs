using System.Security.Claims;
using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Tests;

public static class TestHelpers
{
    public static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new ApplicationDbContext(options);
    }

    public static CurrentUserService CreateCurrentUser(int userId = 1, string userName = "testuser")
    {
        var claims = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.Role, "Admin")
        }, "Test");
        var httpContext = new DefaultHttpContext { User = new ClaimsPrincipal(claims) };
        var accessor = new HttpContextAccessor { HttpContext = httpContext };
        return new CurrentUserService(accessor);
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
}
