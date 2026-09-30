using ChickenWholesale.Api.Controllers;
using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ChickenWholesale.Tests;

/// <summary>
/// Covers the chicken processing/cutting/yield/costing feature end to end: batch
/// creation, the Draft/Completed/Cancelled transition guard, weight-based cost
/// allocation, balance validation, concurrency-safe raw-stock consumption, and the new
/// cash-vs-credit / daily-stock / daily-profit reports that depend on it. Real disposable
/// Postgres databases throughout — see TestHelpers' doc comment for why.
/// </summary>
public class ProcessingBatchTests
{
    private static ProcessingBatchesController MakeController(ApplicationDbContext db, CurrentUserService? user = null)
    {
        var currentUser = user ?? TestHelpers.CreateCurrentUser();
        return new ProcessingBatchesController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), currentUser);
    }

    private static async Task<(Product raw, Product boneless, Product breast)> SeedIngredientsAsync(ApplicationDbContext db, decimal rawStock = 500)
    {
        var raw = await TestHelpers.SeedRawMaterialAsync(db, "RM-T1", rawStock);
        var boneless = await TestHelpers.SeedFinishedProductAsync(db, "BL-T1", "Boneless", 0, 1050);
        var breast = await TestHelpers.SeedFinishedProductAsync(db, "BR-T1", "Breast", 0, 900);
        return (raw, boneless, breast);
    }

    // ---------- 1. Creation ----------
    [Fact]
    public async Task Create_ProcessingBatch_PersistsAsDraftWithNoStockMovement()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db);
        var controller = MakeController(db);

        var result = await controller.Create(new CreateProcessingBatchRequest(
            null,
            new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 150), new(breast.Id, 70) },
            20, "Trimming loss", null));

        var dto = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(ProcessingBatchStatus.Draft, dto.Status);
        Assert.StartsWith("PB-", dto.BatchNumber);

        // Draft must not touch stock at all (section 6) — only the opening purchase
        // transaction from seeding exists, nothing from Create() itself.
        Assert.Equal(500, await TestHelpers.FreshStock(db, raw.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Single(db.InventoryTransactions);
    }

    [Fact]
    public async Task Create_RejectsNonRawMaterialAsInput_AndNonFinishedAsOutput()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, _) = await SeedIngredientsAsync(db);
        var controller = MakeController(db);

        // boneless (FinishedProduct) used as input -> rejected
        var badInput = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(boneless.Id, 10) }, null, 0, null, null));
        Assert.IsType<BadRequestObjectResult>(badInput.Result);

        // raw (RawMaterial) used as output -> rejected
        var badOutput = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 10) },
            new List<ProcessingOutputRequest> { new(raw.Id, 5) }, 0, null, null));
        Assert.IsType<BadRequestObjectResult>(badOutput.Result);
    }

    // ---------- 2, 3, 4, 9, 10. Completing a balanced batch: stock + cost allocation ----------
    [Fact]
    public async Task CompleteProcessingBatch_MovesStockAndAllocatesCostByWeight()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null,
            new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) },
            20, "Trimming loss", null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        var completeResult = await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));
        var completed = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(completeResult.Result).Value);
        Assert.Equal(ProcessingBatchStatus.Completed, completed.Status);

        // Raw material fully consumed (300 + 180 + 20 waste = 500 input).
        Assert.Equal(0, await TestHelpers.FreshStock(db, raw.Id));
        // Finished stock produced.
        Assert.Equal(300, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Equal(180, await TestHelpers.FreshStock(db, breast.Id));

        // Weight-based allocation: 500kg @ 550/kg = 275000 total cost, spread across the
        // 480kg of usable output = 572.9167/kg (section 8/9's worked formula).
        var baseUnitCost = Math.Round(500m * 550m / 480m, 4);
        Assert.Equal(baseUnitCost, completed.Outputs.First(o => o.ProductId == boneless.Id).UnitCost);
        Assert.Equal(baseUnitCost, completed.Outputs.First(o => o.ProductId == breast.Id).UnitCost);
        Assert.Equal(Math.Round(300m * baseUnitCost, 2), completed.Outputs.First(o => o.ProductId == boneless.Id).AllocatedCost);

        // Rounding tolerance aside, allocated cost across outputs should reconstruct the
        // total raw cost consumed.
        var totalAllocated = completed.Outputs.Sum(o => o.AllocatedCost);
        Assert.True(Math.Abs(totalAllocated - 275000m) < 1m);

        // Every movement belongs to this batch (section 7).
        var movements = await db.InventoryTransactions.AsNoTracking().Where(t => t.ReferenceId == batch.Id).ToListAsync();
        Assert.Contains(movements, m => m.MovementType == InventoryMovementType.PROCESSING_OUT && m.ProductId == raw.Id);
        Assert.Contains(movements, m => m.MovementType == InventoryMovementType.PROCESSING_IN && m.ProductId == boneless.Id);
    }

    // ---------- 5. Unbalanced batch rejected ----------
    [Fact]
    public async Task Complete_UnbalancedBatch_IsRejectedAndTouchesNoStock()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        // 500 input should equal 300+180+20=500, but declare only 10kg waste -> unbalanced.
        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 10, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        // Called directly (not through the HTTP pipeline), so the validation failure
        // surfaces as a real exception here — ExceptionMiddleware is what turns this into
        // a 400 for actual API callers (see ConfirmSalesOrder_ThrowsWhenInsufficientStock
        // for the same pattern with InsufficientStockException).
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed)));

        Assert.Equal(500, await TestHelpers.FreshStock(db, raw.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Single(db.InventoryTransactions); // only the opening seed purchase
    }

    // ---------- 6. Insufficient raw stock rejected ----------
    [Fact]
    public async Task Complete_InsufficientRawStock_IsRejected()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 100); // only 100kg on hand
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) }, // wants 500kg
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await Assert.ThrowsAsync<InsufficientStockException>(async () =>
            await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed)));

        // Rejected atomically — raw stock must be untouched, not partially deducted, and
        // the whole transaction (including the failed attempt) rolled back.
        Assert.Equal(100, await TestHelpers.FreshStock(db, raw.Id));
        Assert.Single(db.InventoryTransactions); // only the opening seed purchase
    }

    // ---------- 7. Duplicate completion rejected ----------
    [Fact]
    public async Task Complete_Twice_SecondAttemptRejectedNotReapplied()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);

        await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));
        Assert.Equal(300, await TestHelpers.FreshStock(db, boneless.Id));

        var secondComplete = await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));
        Assert.IsType<BadRequestObjectResult>(secondComplete.Result);

        // Stock must not have been produced twice.
        Assert.Equal(300, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, raw.Id));
    }

    // ---------- 8. Cancellation reverses stock exactly once ----------
    [Fact]
    public async Task Cancel_CompletedBatch_ReversesStockExactlyOnce()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        var cancelResult = await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Cancelled));
        Assert.IsType<OkObjectResult>(cancelResult.Result);

        // Raw material restored, finished goods removed — back to the pre-batch state.
        Assert.Equal(500, await TestHelpers.FreshStock(db, raw.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, breast.Id));

        // Cancelling again must be rejected — nothing leaves the Cancelled state, and
        // stock must not be reversed a second time.
        var secondCancel = await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Cancelled));
        Assert.IsType<BadRequestObjectResult>(secondCancel.Result);
        Assert.Equal(500, await TestHelpers.FreshStock(db, raw.Id));
    }

    [Fact]
    public async Task Cancel_CompletedBatch_RejectedIfOutputAlreadySold()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        // Sell some of the boneless this batch produced before cancelling.
        var boneless2 = await TestHelpers.FreshStock(db, boneless.Id);
        Assert.Equal(300, boneless2);
        await db.Products.Where(p => p.Id == boneless.Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.CurrentStock, p => p.CurrentStock - 250));

        // Cancellation must fail rather than drive boneless stock negative — data
        // integrity over cancellation convenience (section 6/19's guiding principle).
        await Assert.ThrowsAsync<InsufficientStockException>(async () =>
            await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Cancelled)));
        Assert.Equal(50, await TestHelpers.FreshStock(db, boneless.Id));
        // And the batch must still read Completed, not stuck half-cancelled.
        var reloaded = await controller.GetById(batch.Id);
        var reloadedDto = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(reloaded.Result).Value);
        Assert.Equal(ProcessingBatchStatus.Completed, reloadedDto.Status);
    }

    /// <summary>
    /// UAT-discovered blocker: finished stock is a fungible pool with no per-batch/lot
    /// tracking. When TWO completed batches both produce the same finished product,
    /// cancelling the SECOND batch after some of ITS output was sold used to be allowed as
    /// long as the FIRST batch's still-unsold output covered the reversal quantity in
    /// aggregate — i.e. the old guard only checked "would this take total stock negative",
    /// not "was this batch's own output actually sold". That silently double-counted the
    /// raw material (added back as if this batch was never processed) while the sale that
    /// already happened kept its own historical cost snapshot untouched — a real,
    /// non-obvious accounting corruption a store keeper could trigger by cancelling an old
    /// batch days after its output had already moved. Fixed by refusing to reverse a
    /// batch's output if ANY unit of that output product left stock (sold, wasted,
    /// adjusted out, or consumed by later processing) since this batch's own output joined
    /// the pool, regardless of how much unrelated stock happens to still be on hand.
    /// </summary>
    [Fact]
    public async Task Cancel_CompletedBatch_RejectedIfOutputSold_EvenWhenAnotherBatchsStockMasksIt()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 800);
        var controller = MakeController(db);

        // Batch A: produces 300kg boneless.
        var batchACreate = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batchA = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(batchACreate.Result).Value);
        await controller.UpdateStatus(batchA.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        // Batch B: produces a much smaller 90kg of the same boneless product.
        var batchBCreate = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 300) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 90), new(breast.Id, 198) }, 12, null, null));
        var batchB = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(batchBCreate.Result).Value);
        await controller.UpdateStatus(batchB.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        Assert.Equal(390, await TestHelpers.FreshStock(db, boneless.Id)); // 300 + 90 pooled together

        // Sell 40kg of boneless through the real sales flow (a genuine SALE ledger entry,
        // not a direct stock edit) — the pool doesn't distinguish which batch it came from.
        var hotel = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();
        var ordersController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var order = await ordersController.Create(new CreateSalesOrderRequest(
            hotel.Id, null, null, new List<SalesOrderItemRequest> { new(boneless.Id, 40, 1050) }, 0, 0, 0, null));
        var orderDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(order.Result).Value);
        await ordersController.UpdateStatus(orderDto.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        Assert.Equal(350, await TestHelpers.FreshStock(db, boneless.Id)); // 390 - 40

        // Cancelling Batch B only needs to remove 90kg from a 350kg pool — nowhere near
        // negative — so the old "stock non-negative" guard would have let this through even
        // though 40kg of exactly this batch's own output already left the building.
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await controller.UpdateStatus(batchB.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Cancelled)));

        // Nothing must have moved: no raw material double-counted back in, no finished
        // stock removed, batch still Completed.
        Assert.Equal(350, await TestHelpers.FreshStock(db, boneless.Id));
        Assert.Equal(0, await TestHelpers.FreshStock(db, raw.Id));
        var reloaded = await controller.GetById(batchB.Id);
        var reloadedDto = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(reloaded.Result).Value);
        Assert.Equal(ProcessingBatchStatus.Completed, reloadedDto.Status);

        // Batch A produced boneless earlier too, and the same sale happened after Batch A's
        // output joined the pool as well — with no lot tracking there is no way to prove
        // the 40kg sold came from Batch B and not Batch A, so the same conservative rule
        // correctly refuses to cancel Batch A either, rather than guessing. This is the
        // accepted cost of not implementing FIFO/lot-level costing (see BUSINESS_WORKFLOW.md):
        // once any sale of a product happens, batches that produced it become "locked in"
        // and can no longer be cancelled — cancel is for catching a mistake immediately
        // after completing a batch, not for editing processing history after the fact.
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await controller.UpdateStatus(batchA.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Cancelled)));
        Assert.Equal(350, await TestHelpers.FreshStock(db, boneless.Id));
    }

    // ---------- 11, 12. Cash sale vs credit sale, feeding cash-vs-credit / daily-profit ----------
    [Fact]
    public async Task CashSale_AgainstWalkInCustomer_ReducesStockAndIsClassifiedAsCash()
    {
        var db = TestHelpers.CreateDb();
        var boneless = await TestHelpers.SeedFinishedProductAsync(db, "BL-CASH", "Boneless", 100, 1050);
        var walkIn = new Customer { CustomerCode = "CASH-001", BusinessName = "Walk-in / Cash Customer", Phone = "N/A", CustomerType = CustomerType.Individual, IsActive = true };
        var hotel = await TestHelpers.SeedCustomerAsync(db);
        db.Customers.Add(walkIn);
        await db.SaveChangesAsync();

        var currentUser = TestHelpers.CreateCurrentUser();
        var ordersController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);

        // Cash sale: 10kg boneless, paid in full immediately.
        var cashOrder = await ordersController.Create(new CreateSalesOrderRequest(
            walkIn.Id, null, null, new List<SalesOrderItemRequest> { new(boneless.Id, 10, 1050) }, 0, 0, 10500, null));
        var cashDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(cashOrder.Result).Value);
        await ordersController.UpdateStatus(cashDto.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        // Credit sale to the hotel: 20kg, half paid.
        var creditOrder = await ordersController.Create(new CreateSalesOrderRequest(
            hotel.Id, null, null, new List<SalesOrderItemRequest> { new(boneless.Id, 20, 1050) }, 0, 0, 10500, null));
        var creditDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(creditOrder.Result).Value);
        await ordersController.UpdateStatus(creditDto.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        Assert.Equal(70, await TestHelpers.FreshStock(db, boneless.Id)); // 100 - 10 - 20

        var reportsController = new ReportsController(db);
        var split = await reportsController.CashVsCredit(null, null);
        var splitDto = Assert.IsType<CashVsCreditDto>(Assert.IsType<OkObjectResult>(split.Result).Value);

        Assert.Equal(10500m, splitDto.CashSales);
        Assert.Equal(1, splitDto.CashOrderCount);
        Assert.Equal(21000m, splitDto.CreditSales);
        Assert.Equal(1, splitDto.CreditOrderCount);

        // Credit sale must show up on the customer's ledger as a receivable.
        var updatedHotel = await TestHelpers.FreshCustomer(db, hotel.Id);
        Assert.Equal(10500m, updatedHotel.CurrentBalance); // 21000 grand total - 10500 paid
        var updatedWalkIn = await TestHelpers.FreshCustomer(db, walkIn.Id);
        Assert.Equal(0m, updatedWalkIn.CurrentBalance); // cash sale always fully settled
    }

    // ---------- 13. Daily stock reconciliation ----------
    [Fact]
    public async Task DailyStockReport_OpeningPlusMovementsEqualsClosing()
    {
        var db = TestHelpers.CreateDb();
        var (raw, boneless, breast) = await SeedIngredientsAsync(db, rawStock: 500);
        var controller = MakeController(db);

        var createResult = await controller.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 500) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 300), new(breast.Id, 180) }, 20, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createResult.Result).Value);
        await controller.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        var reportsController = new ReportsController(db);
        var report = await reportsController.DailyStock(DateTime.UtcNow.Date, null);
        var rows = Assert.IsAssignableFrom<System.Collections.IEnumerable>(Assert.IsType<OkObjectResult>(report).Value)
            .Cast<DailyStockReportRow>().ToList();

        var rawRow = rows.First(r => r.SKU == raw.SKU);
        Assert.Equal(500, rawRow.Opening); // seeded via a "yesterday" purchase transaction
        Assert.Equal(500, rawRow.ProcessedOut);
        Assert.Equal(rawRow.Opening + rawRow.Purchased + rawRow.ProcessedIn - rawRow.Sold - rawRow.ProcessedOut - rawRow.Waste
            - rawRow.AdjustmentOut + rawRow.AdjustmentIn + rawRow.ReturnIn - rawRow.ReturnOut, rawRow.Closing);
        Assert.Equal(await TestHelpers.FreshStock(db, raw.Id), rawRow.Closing);

        var bonelessRow = rows.First(r => r.SKU == boneless.SKU);
        Assert.Equal(300, bonelessRow.ProcessedIn);
        Assert.Equal(await TestHelpers.FreshStock(db, boneless.Id), bonelessRow.Closing);
    }

    // ---------- 14. Daily profit calculation ----------
    [Fact]
    public async Task DailyProfitReport_ComputesGrossAndOperatingProfit()
    {
        var db = TestHelpers.CreateDb();
        var boneless = await TestHelpers.SeedFinishedProductAsync(db, "BL-DP", "Boneless", 100, 1050);
        boneless.PurchasePrice = 600; // known cost basis for the assertion below
        await db.SaveChangesAsync();
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var ordersController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var order = await ordersController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(boneless.Id, 20, 1050) }, 0, 0, 21000, null));
        var orderDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(order.Result).Value);
        await ordersController.UpdateStatus(orderDto.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        var expenseCategory = new ExpenseCategory { Name = "Fuel" };
        db.ExpenseCategories.Add(expenseCategory);
        await db.SaveChangesAsync();
        db.Expenses.Add(new Expense { Category = expenseCategory, Amount = 1000, Date = DateTime.UtcNow, PaymentMethod = PaymentMethod.Cash, Description = "Test expense", CreatedByUserId = currentUser.UserId });
        await db.SaveChangesAsync();

        var reportsController = new ReportsController(db);
        var result = await reportsController.DailyProfit(DateTime.UtcNow.Date);
        var dto = Assert.IsType<DailyProfitDto>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal(21000m, dto.TotalSales);
        Assert.Equal(12000m, dto.EstimatedCogs); // 20kg * 600/kg cost snapshot at sale time
        Assert.Equal(9000m, dto.GrossProfit);
        Assert.Equal(1000m, dto.Expenses);
        Assert.Equal(8000m, dto.OperatingProfitLoss);
    }

    // ---------- 15. Concurrency: two batches racing for the same raw stock ----------
    [Fact]
    public async Task ConcurrentProcessing_OnlyOneSucceedsWhenCombinedExceedsRawStock()
    {
        var dbA = TestHelpers.CreateDb();
        var dbB = TestHelpers.CreateSecondContext(dbA);
        var currentUser = TestHelpers.CreateCurrentUser();

        // 500kg on hand; two batches each individually valid (400kg, 300kg) but their sum
        // (700kg) exceeds available stock — only one may succeed.
        var raw = await TestHelpers.SeedRawMaterialAsync(dbA, "RM-CONC", 500);
        var bonelessA = await TestHelpers.SeedFinishedProductAsync(dbA, "BL-CA", "Boneless A", 0, 1050);
        var bonelessB = await TestHelpers.SeedFinishedProductAsync(dbA, "BL-CB", "Boneless B", 0, 1050);

        var setupController = MakeController(dbA, currentUser);
        var createA = await setupController.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 400) },
            new List<ProcessingOutputRequest> { new(bonelessA.Id, 380) }, 20, null, null));
        var batchA = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createA.Result).Value);

        var createB = await setupController.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 300) },
            new List<ProcessingOutputRequest> { new(bonelessB.Id, 280) }, 20, null, null));
        var batchB = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(createB.Result).Value);

        var controllerA = MakeController(dbA, currentUser);
        var controllerB = MakeController(dbB, currentUser);

        // A failed completion surfaces as a thrown InsufficientStockException when called
        // directly like this (see the other tests in this file) rather than as a typed
        // BadRequest result, so both race participants are wrapped to capture "succeeded
        // or threw" uniformly instead of asserting on the .Result shape.
        static async Task<bool> TryComplete(Task<ActionResult<ProcessingBatchDto>> task)
        {
            try { return Assert.IsType<OkObjectResult>((await task).Result) != null; }
            catch (InsufficientStockException) { return false; }
        }

        var taskA = TryComplete(controllerA.UpdateStatus(batchA.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed)));
        var taskB = TryComplete(controllerB.UpdateStatus(batchB.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed)));
        await Task.WhenAll(taskA, taskB);

        // Exactly one of the two concurrent completions may succeed — never both (that
        // would require 700kg from a 500kg pool) and never zero (each is individually
        // valid against the starting stock).
        Assert.NotEqual(taskA.Result, taskB.Result);

        // Raw stock must never go negative, and must reflect exactly one batch's consumption.
        var finalRawStock = await TestHelpers.FreshStock(dbA, raw.Id);
        Assert.True(finalRawStock == 100 || finalRawStock == 200); // 500-400 or 500-300
        Assert.True(finalRawStock >= 0);
    }

    // ---------- 16. Historical sale rate preserved ----------
    [Fact]
    public async Task HistoricalSaleRate_PreservedAfterProductPriceLaterChanges()
    {
        var db = TestHelpers.CreateDb();
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var controller = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var order = await controller.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 10, 750) }, 0, 0, 0, null));
        var orderDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(order.Result).Value);

        // Price changes after the order was placed.
        await db.Products.Where(p => p.Id == product.Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.SalePrice, 999));

        var reloaded = await controller.GetById(orderDto.Id);
        var reloadedDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(reloaded.Result).Value);
        Assert.Equal(750, reloadedDto.Items[0].Rate); // unaffected by the later price change
    }

    // ---------- 17. Historical cost preserved ----------
    [Fact]
    public async Task HistoricalCost_PreservedAfterLaterProcessingChangesProductCost()
    {
        var db = TestHelpers.CreateDb();
        var boneless = await TestHelpers.SeedFinishedProductAsync(db, "BL-HIST", "Boneless", 50, 1050);
        boneless.PurchasePrice = 600;
        await db.SaveChangesAsync();
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var currentUser = TestHelpers.CreateCurrentUser();

        var ordersController = new SalesOrdersController(db, new AuditService(db, currentUser), new CodeGeneratorService(db),
            new InventoryService(db, currentUser), new LedgerService(db), currentUser);
        var order = await ordersController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(boneless.Id, 10, 1050) }, 0, 0, 0, null));
        var orderDto = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(order.Result).Value);
        await ordersController.UpdateStatus(orderDto.Id, new UpdateOrderStatusRequest(SalesOrderStatus.Confirmed));

        var saleMovement = await db.InventoryTransactions.AsNoTracking()
            .FirstAsync(t => t.ProductId == boneless.Id && t.MovementType == InventoryMovementType.SALE);
        Assert.Equal(600, saleMovement.UnitCost);

        // Now a processing batch completes for this same product, changing its current
        // cost basis to something else entirely.
        var raw = await TestHelpers.SeedRawMaterialAsync(db, "RM-HIST", 100, purchasePrice: 900);
        var processingController = MakeController(db, currentUser);
        var batchResult = await processingController.Create(new CreateProcessingBatchRequest(
            null, new List<ProcessingInputRequest> { new(raw.Id, 100) },
            new List<ProcessingOutputRequest> { new(boneless.Id, 90) }, 10, null, null));
        var batch = Assert.IsType<ProcessingBatchDto>(Assert.IsType<OkObjectResult>(batchResult.Result).Value);
        await processingController.UpdateStatus(batch.Id, new UpdateProcessingBatchStatusRequest(ProcessingBatchStatus.Completed));

        var updatedProduct = await db.Products.AsNoTracking().FirstAsync(p => p.Id == boneless.Id);
        Assert.NotEqual(600, updatedProduct.PurchasePrice); // current cost basis has moved on

        // But the earlier sale's cost snapshot must be untouched.
        var sameSaleMovement = await db.InventoryTransactions.AsNoTracking()
            .FirstAsync(t => t.Id == saleMovement.Id);
        Assert.Equal(600, sameSaleMovement.UnitCost);
    }
}
