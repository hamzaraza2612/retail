using ChickenWholesale.Api.Controllers;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    // ---------- Code generation is collision-free under real concurrency ----------
    [Fact]
    public async Task CodeGenerator_ConcurrentCustomerCreation_NeverGeneratesDuplicateCodes()
    {
        // Regression test for the audit finding that COUNT(*)+1 code generation could
        // hand two concurrent requests the same customer code, crashing the loser on the
        // unique index. CodeGeneratorService is now backed by a Postgres SEQUENCE
        // (nextval() is atomic by construction), so firing several real concurrent
        // requests must succeed with distinct codes and no exception.
        var dbA = TestHelpers.CreateDb();
        var currentUser = TestHelpers.CreateCurrentUser();

        var contexts = new[] { dbA, TestHelpers.CreateSecondContext(dbA), TestHelpers.CreateSecondContext(dbA), TestHelpers.CreateSecondContext(dbA) };
        var controllers = contexts.Select(db => new CustomersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db))).ToArray();

        var tasks = controllers.Select((c, i) => c.Create(new CreateCustomerRequest(
            $"Concurrent Customer {i}", null, $"0300-000000{i}", null, null, null,
            CustomerType.Individual, 0, null, 0, null))).ToArray();
        await Task.WhenAll(tasks);

        var codes = tasks.Select(t => Assert.IsType<CustomerDto>(Assert.IsType<OkObjectResult>(t.Result.Result).Value).CustomerCode).ToList();
        Assert.Equal(codes.Count, codes.Distinct().Count());

        var totalInDb = await dbA.Customers.AsNoTracking().CountAsync();
        Assert.Equal(4, totalInDb);
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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var result = await controller.Create(new CreatePurchaseRequest(
            supplier.Id, null, "SUPINV-1", new List<PurchaseItemRequest> { new(product.Id, 100, 650) }, 40000, null));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<PurchaseDto>(ok.Value);

        Assert.Equal(65000, dto.TotalAmount);
        Assert.Equal(25000, dto.RemainingAmount);

        Assert.Equal(100, await TestHelpers.FreshStock(db, product.Id));

        var updatedSupplier = await TestHelpers.FreshSupplier(db, supplier.Id);
        Assert.Equal(25000, updatedSupplier.CurrentBalance);

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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 30, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        // Confirm once -> stock should drop by 30
        var confirmResult = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.IsType<OkObjectResult>(confirmResult.Result);

        Assert.Equal(70, await TestHelpers.FreshStock(db, product.Id));
        Assert.Single(db.Invoices);

        // Move to Processing (should NOT deduct stock again - idempotency guard)
        var processingResult = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Processing));
        Assert.IsType<OkObjectResult>(processingResult.Result);

        Assert.Equal(70, await TestHelpers.FreshStock(db, product.Id));
        Assert.Single(db.Invoices); // still only one invoice

        var updatedCustomer = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(22500, updatedCustomer.CurrentBalance); // 30 * 750, unpaid
    }

    // ---------- Re-sending an already-applied transition is rejected, not re-applied ----------
    [Fact]
    public async Task ConfirmSalesOrder_RepeatingSameTransitionIsRejectedNotReapplied()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 30, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.Equal(70, await TestHelpers.FreshStock(db, product.Id));

        // Sending "Confirmed" again (simulating a double-click) must be rejected by the
        // transition table (Confirmed -> Confirmed is not an allowed edge), not silently
        // re-deduct stock or create a second invoice.
        var secondConfirm = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.IsType<BadRequestObjectResult>(secondConfirm.Result);

        Assert.Equal(70, await TestHelpers.FreshStock(db, product.Id));
        Assert.Single(db.Invoices);
    }

    // ---------- Concurrent double-confirm: only one worker's request may succeed ----------
    [Fact]
    public async Task ConfirmSalesOrder_ConcurrentDoubleConfirm_OnlyOneSucceeds()
    {
        var dbA = TestHelpers.CreateDb();
        var dbB = TestHelpers.CreateSecondContext(dbA);
        var currentUser = TestHelpers.CreateCurrentUser();

        var product = await TestHelpers.SeedProductAsync(dbA, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(dbA);

        var setupController = new SalesOrdersController(dbA, new AuditService(dbA, currentUser), new CodeGeneratorService(dbA),
            new InventoryService(dbA, currentUser), new LedgerService(dbA), currentUser);
        var createResult = await setupController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 30, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        // Two independent DbContexts sharing the same store simulate two workers each
        // holding their own request-scoped context, both racing to confirm the same order.
        var controllerA = new SalesOrdersController(dbA, new AuditService(dbA, currentUser), new CodeGeneratorService(dbA),
            new InventoryService(dbA, currentUser), new LedgerService(dbA), currentUser);
        var controllerB = new SalesOrdersController(dbB, new AuditService(dbB, currentUser), new CodeGeneratorService(dbB),
            new InventoryService(dbB, currentUser), new LedgerService(dbB), currentUser);

        // Launched together (not awaited one at a time) so both requests genuinely race:
        // each independently loads the order while it is still Draft, before either has
        // committed its transition. This is what the atomic claim in UpdateStatus must
        // protect against.
        var taskA = controllerA.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        var taskB = controllerB.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        await Task.WhenAll(taskA, taskB);

        // The core invariant under test: whichever HTTP status the loser gets back
        // (Conflict from the atomic claim, or BadRequest if it lost the race before even
        // reaching the claim), exactly one of the two concurrent requests may succeed —
        // never both, and never zero.
        var outcomes = new[] { taskA.Result.Result, taskB.Result.Result };
        Assert.Single(outcomes.OfType<OkObjectResult>());
        Assert.Single(outcomes, r => r is not OkObjectResult);

        Assert.Equal(70, await TestHelpers.FreshStock(dbA, product.Id));
        var invoiceCount = await dbA.Invoices.AsNoTracking().CountAsync();
        Assert.Equal(1, invoiceCount);
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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 500, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await Assert.ThrowsAsync<InsufficientStockException>(async () =>
            await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed)));

        Assert.Equal(10, await TestHelpers.FreshStock(db, product.Id)); // unchanged - rolled back
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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var createResult = await orderController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await orderController.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        var invoice = db.Invoices.First();
        var balanceBefore = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(7500, balanceBefore.CurrentBalance);

        var paymentsController = new PaymentsController(db, new AuditService(db, currentUser), new CodeGeneratorService(db), new LedgerService(db), currentUser);
        var paymentResult = await paymentsController.Create(new CreatePaymentRequest(customer.Id, invoice.Id, 3000, null, PaymentMethod.Cash, null, null));
        Assert.IsType<OkObjectResult>(paymentResult.Result);

        var balanceAfter = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(4500, balanceAfter.CurrentBalance);

        var updatedInvoice = await TestHelpers.FreshInvoice(db, invoice.Id);
        Assert.Equal(4500, updatedInvoice.BalanceAmount);
        Assert.Equal(PaymentStatus.Partial, updatedInvoice.PaymentStatus);
    }

    // ---------- Overpayment against a single invoice is rejected ----------
    [Fact]
    public async Task CustomerPayment_RejectsAmountExceedingInvoiceBalance()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var orderController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var createResult = await orderController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await orderController.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        var invoice = db.Invoices.First(); // balance = 7500

        var paymentsController = new PaymentsController(db, new AuditService(db, currentUser), new CodeGeneratorService(db), new LedgerService(db), currentUser);
        var result = await paymentsController.Create(new CreatePaymentRequest(customer.Id, invoice.Id, 999999, null, PaymentMethod.Cash, null, null));

        Assert.IsType<BadRequestObjectResult>(result.Result);
        var unchangedCustomer = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(7500, unchangedCustomer.CurrentBalance);
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
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var purchaseResult = await purchaseController.Create(new CreatePurchaseRequest(
            supplier.Id, null, null, new List<PurchaseItemRequest> { new(product.Id, 100, 650) }, 20000, null));
        var purchase = Assert.IsType<PurchaseDto>(Assert.IsType<OkObjectResult>(purchaseResult.Result).Value);

        Assert.Equal(45000, (await TestHelpers.FreshSupplier(db, supplier.Id)).CurrentBalance);

        var supplierPaymentsController = new SupplierPaymentsController(db, new AuditService(db, currentUser), new CodeGeneratorService(db), new LedgerService(db), currentUser);
        var payResult = await supplierPaymentsController.Create(new CreateSupplierPaymentRequest(supplier.Id, purchase.Id, 15000, null, PaymentMethod.BankTransfer, null, null));
        Assert.IsType<OkObjectResult>(payResult.Result);

        Assert.Equal(30000, (await TestHelpers.FreshSupplier(db, supplier.Id)).CurrentBalance);
        Assert.Equal(30000, (await TestHelpers.FreshPurchase(db, purchase.Id)).RemainingAmount);
    }

    // ---------- Cancellation reverses stock/balance exactly once ----------
    [Fact]
    public async Task CancelConfirmedOrder_RestoresStockOnceAndDoesNotDoubleRestore()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 20, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        Assert.Equal(80, await TestHelpers.FreshStock(db, product.Id));

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Cancelled));
        Assert.Equal(100, await TestHelpers.FreshStock(db, product.Id));

        // Attempting further status change on a cancelled order should be rejected
        var result = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Processing));
        Assert.IsType<BadRequestObjectResult>(result.Result);

        // stock should still be 100, not restored twice
        Assert.Equal(100, await TestHelpers.FreshStock(db, product.Id));
    }

    /// <summary>
    /// UAT-discovered blocker: cancelling a Confirmed order correctly restores stock and
    /// adjusts the customer's running balance (see the test above), but was leaving the
    /// Invoice created at Confirm time completely untouched — a live UAT run caught it
    /// still showing its original GrandTotal/BalanceAmount as an outstanding receivable
    /// after the order (and the sale it billed) had been cancelled, even though the
    /// customer's own CurrentBalance no longer included it. That "ghost invoice" would
    /// keep showing up in an Invoices list or receivables report as money owed for a sale
    /// that no longer exists. Fixed by zeroing the invoice's financial fields and marking
    /// it Paid (rather than deleting it, so the invoice number and audit trail survive)
    /// whenever the order that generated it is cancelled.
    /// </summary>
    [Fact]
    public async Task CancelConfirmedOrder_AlsoZeroesTheOrphanedInvoice()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 20, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));
        var updatedCustomer = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(15000m, updatedCustomer.CurrentBalance); // 20 * 750, unpaid credit sale

        await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Cancelled));

        // Customer balance is correctly back to zero...
        updatedCustomer = await TestHelpers.FreshCustomer(db, customer.Id);
        Assert.Equal(0m, updatedCustomer.CurrentBalance);

        // ...and the invoice this order generated must no longer show a receivable either.
        var invoice = await db.Invoices.AsNoTracking().FirstAsync(i => i.SalesOrderId == order.Id);
        Assert.Equal(0m, invoice.GrandTotal);
        Assert.Equal(0m, invoice.BalanceAmount);
        Assert.Equal(PaymentStatus.Paid, invoice.PaymentStatus);

        // ...and the order itself, which the Orders list/detail screens read directly, must
        // not still display a red "still owed" remaining amount contradicting its own
        // Cancelled status.
        var reloadedOrder = await controller.GetById(order.Id);
        var reloadedDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(reloadedOrder.Result).Value);
        Assert.Equal(0m, reloadedDto.RemainingAmount);
        Assert.Equal(PaymentStatus.Paid, reloadedDto.PaymentStatus);
    }

    // ---------- Invalid transition is rejected even when reachable via direct API call ----------
    [Fact]
    public async Task UpdateStatus_RejectsSkippingConfirmedStraightToDelivered()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        var createResult = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 20, 750) }, 0, 0, 0, null));
        var order = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        // Draft -> Delivered directly must be rejected: it would skip stock deduction and invoicing entirely.
        var result = await controller.UpdateStatus(order.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Delivered));
        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(100, await TestHelpers.FreshStock(db, product.Id));
        Assert.Empty(db.Invoices);
    }

    // ---------- Deactivated customer/product cannot be used in new transactions ----------
    [Fact]
    public async Task CreateSalesOrder_RejectsInactiveCustomerAndProduct()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        customer.IsActive = false;
        await db.SaveChangesAsync();

        var result = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        Assert.IsType<BadRequestObjectResult>(result.Result);

        customer.IsActive = true;
        product.IsActive = false;
        await db.SaveChangesAsync();

        var result2 = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        Assert.IsType<BadRequestObjectResult>(result2.Result);
    }
}
