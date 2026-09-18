using ChickenWholesale.Api.Controllers;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ChickenWholesale.Tests;

public class BusinessLogicTests
{
    // ---------- Customer creation ----------
    [Fact]
    public async Task CreateCustomer_PersistsWithGeneratedCode()
    {
        var db = TestHelpers.CreateDb();
        var controller = new CustomersController(db, new AuditService(db, TestHelpers.CreateCurrentUser()), new CodeGeneratorService(db));

        var result = await controller.Create(new CreateCustomerRequest(
            "Test Restaurant", "Mr. Ali", "0300-1111111", null, null, null,
            CustomerType.Restaurant, 100000, "15 Days", 0, null));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<CustomerDto>(ok.Value);
        Assert.Equal("Test Restaurant", dto.BusinessName);
        Assert.StartsWith("CUST-", dto.CustomerCode);
        Assert.Single(db.Customers);
    }

    // ---------- Product creation ----------
    [Fact]
    public async Task CreateProduct_StartsWithZeroStock()
    {
        var db = TestHelpers.CreateDb();
        var category = new ProductCategory { Name = "Whole Chicken" };
        db.ProductCategories.Add(category);
        await db.SaveChangesAsync();

        var controller = new ProductsController(db, new AuditService(db, TestHelpers.CreateCurrentUser()));
        var result = await controller.Create(new CreateProductRequest("WC-TEST", "Whole Chicken", category.Id, UnitOfMeasure.KG, 480, 550, 50, null));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<ProductDto>(ok.Value);
        Assert.Equal(0, dto.CurrentStock);
    }

    // ---------- Purchase increases stock ----------
    [Fact]
    public async Task CreatePurchase_IncreasesProductStockAndSupplierPayable()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 0);
        var supplier = await TestHelpers.SeedSupplierAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new PurchasesController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);

        var result = await controller.Create(new CreatePurchaseRequest(
            supplier.Id, null, "SUPINV-1", new List<PurchaseItemRequest> { new(product.Id, 100, 650) }, 40000, null));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<PurchaseDto>(ok.Value);

        Assert.Equal(65000, dto.TotalAmount);
        Assert.Equal(25000, dto.RemainingAmount);

        var updatedProduct = await db.Products.FindAsync(product.Id);
        Assert.Equal(100, updatedProduct!.CurrentStock);

        var updatedSupplier = await db.Suppliers.FindAsync(supplier.Id);
        Assert.Equal(25000, updatedSupplier!.CurrentBalance);

        Assert.Single(db.InventoryTransactions);
        Assert.Equal(InventoryMovementType.PURCHASE, db.InventoryTransactions.First().MovementType);
    }

    // ---------- Sale decreases stock exactly once (idempotency) ----------
    [Fact]
    public async Task ConfirmSalesOrder_DecreasesStockOnceAndCreatesInvoice()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 30, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        // Confirm once -> stock should drop by 30
        var confirmResult = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.IsType<OkObjectResult>(confirmResult.Result);

        var productAfterFirstConfirm = await db.Products.FindAsync(product.Id);
        Assert.Equal(70, productAfterFirstConfirm!.CurrentStock);
        Assert.Single(db.Invoices);

        // Move to Processing (should NOT deduct stock again - idempotency guard)
        var processingResult = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Processing));
        Assert.IsType<OkObjectResult>(processingResult.Result);

        var productAfterSecondUpdate = await db.Products.FindAsync(product.Id);
        Assert.Equal(70, productAfterSecondUpdate!.CurrentStock);
        Assert.Single(db.Invoices); // still only one invoice

        var updatedCustomer = await db.Customers.FindAsync(customer.Id);
        Assert.Equal(22500, updatedCustomer!.CurrentBalance); // 30 * 750, unpaid
    }

    // ---------- Negative stock prevention ----------
    [Fact]
    public async Task ConfirmSalesOrder_ThrowsWhenInsufficientStock()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 10);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 500, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await Assert.ThrowsAsync<InsufficientStockException>(async () =>
            await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed)));

        var productAfter = await db.Products.FindAsync(product.Id);
        Assert.Equal(10, productAfter!.CurrentStock); // unchanged - rolled back
    }

    // ---------- Order total calculation ----------
    [Fact]
    public async Task CreateSalesOrder_CalculatesGrandTotalFromItemsDiscountAndDelivery()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 200);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);

        // 100kg @ 750 = 75000, 50kg wings not included here; just test formula with one item
        var result = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 100, 750) }, 5000, 1000, 50000, null));

        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(75000, order.Subtotal);
        Assert.Equal(71000, order.GrandTotal); // 75000 - 5000 + 1000
        Assert.Equal(21000, order.RemainingAmount);
        Assert.Equal(PaymentStatus.Partial, order.PaymentStatus);
    }

    // ---------- Payment decreases receivable ----------
    [Fact]
    public async Task CustomerPayment_ReducesCustomerBalanceAndInvoiceBalance()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var orderController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);
        var createResult = await orderController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await orderController.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        var invoice = db.Invoices.First();
        var balanceBefore = (await db.Customers.FindAsync(customer.Id))!.CurrentBalance;
        Assert.Equal(7500, balanceBefore);

        var paymentsController = new PaymentsController(db, new AuditService(db, currentUser), new CodeGeneratorService(db), currentUser);
        var paymentResult = await paymentsController.Create(new CreatePaymentRequest(customer.Id, invoice.Id, 3000, null, PaymentMethod.Cash, null, null));
        Assert.IsType<OkObjectResult>(paymentResult.Result);

        var balanceAfter = (await db.Customers.FindAsync(customer.Id))!.CurrentBalance;
        Assert.Equal(4500, balanceAfter);

        var updatedInvoice = await db.Invoices.FindAsync(invoice.Id);
        Assert.Equal(4500, updatedInvoice!.BalanceAmount);
        Assert.Equal(PaymentStatus.Partial, updatedInvoice.PaymentStatus);
    }

    // ---------- Supplier payment decreases payable ----------
    [Fact]
    public async Task SupplierPayment_ReducesSupplierBalanceAndPurchaseRemaining()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 0);
        var supplier = await TestHelpers.SeedSupplierAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var purchaseController = new PurchasesController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);
        var purchaseResult = await purchaseController.Create(new CreatePurchaseRequest(
            supplier.Id, null, null, new List<PurchaseItemRequest> { new(product.Id, 100, 650) }, 20000, null));
        var purchase = Assert.IsType<PurchaseDto>(Assert.IsType<OkObjectResult>(purchaseResult.Result).Value);

        Assert.Equal(45000, (await db.Suppliers.FindAsync(supplier.Id))!.CurrentBalance);

        var supplierPaymentsController = new SupplierPaymentsController(db, new AuditService(db, currentUser), new CodeGeneratorService(db), currentUser);
        var payResult = await supplierPaymentsController.Create(new CreateSupplierPaymentRequest(supplier.Id, purchase.Id, 15000, null, PaymentMethod.BankTransfer, null, null));
        Assert.IsType<OkObjectResult>(payResult.Result);

        var updatedSupplier = await db.Suppliers.FindAsync(supplier.Id);
        Assert.Equal(30000, updatedSupplier!.CurrentBalance);

        var updatedPurchase = await db.Purchases.FindAsync(purchase.Id);
        Assert.Equal(30000, updatedPurchase!.RemainingAmount);
    }

    // ---------- Manual stock adjustment: duplicate deduction prevention on cancel ----------
    [Fact]
    public async Task CancelConfirmedOrder_RestoresStockOnceAndDoesNotDoubleRestore()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 20, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.Equal(80, (await db.Products.FindAsync(product.Id))!.CurrentStock);

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Cancelled));
        Assert.Equal(100, (await db.Products.FindAsync(product.Id))!.CurrentStock);

        // Attempting further status change on a cancelled order should be rejected
        var result = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Processing));
        Assert.IsType<BadRequestObjectResult>(result.Result);

        // stock should still be 100, not restored twice
        Assert.Equal(100, (await db.Products.FindAsync(product.Id))!.CurrentStock);
    }
}
