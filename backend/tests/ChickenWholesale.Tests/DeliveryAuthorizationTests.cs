using ChickenWholesale.Api.Controllers;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ChickenWholesale.Tests;

/// <summary>
/// Covers the audit finding "the Delivery role can act on any delivery, not only its own" —
/// a User is now optionally linked to an Employee (via User.EmployeeId, carried in the JWT as
/// an "employeeId" claim), and DeliveriesController uses that link to scope a Delivery-role
/// login to only the deliveries assigned to it.
/// </summary>
public class DeliveryAuthorizationTests
{
    private static async Task<(SalesOrderDto orderA, SalesOrderDto orderB, Employee driverA, Employee driverB)> SeedTwoDeliveriesAsync(
        ChickenWholesale.Api.Data.ApplicationDbContext db)
    {
        var product = await TestHelpers.SeedProductAsync(db, stock: 100);
        var customer = await TestHelpers.SeedCustomerAsync(db);
        var admin = TestHelpers.CreateCurrentUser(role: "Admin");

        var driverA = await TestHelpers.SeedEmployeeAsync(db, "EMP-A", "Driver A");
        var driverB = await TestHelpers.SeedEmployeeAsync(db, "EMP-B", "Driver B");

        var ordersController = new SalesOrdersController(db, new AuditService(db, admin), new CodeGeneratorService(db),
            new InventoryService(db, admin), new LedgerService(db), admin);

        var createA = await ordersController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 5, 750) }, 0, 0, 0, null));
        var orderA = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createA.Result).Value);

        var createB = await ordersController.Create(new CreateSalesOrderRequest(
            customer.Id, null, null, new List<SalesOrderItemRequest> { new(product.Id, 5, 750) }, 0, 0, 0, null));
        var orderB = Assert.IsType<SalesOrderDto>(Assert.IsType<OkObjectResult>(createB.Result).Value);

        var deliveriesController = new DeliveriesController(db, new AuditService(db, admin), admin);
        await deliveriesController.Create(new CreateDeliveryRequest(orderA.Id, "Address A", driverA.Id, "LEA-1", null, null, null));
        await deliveriesController.Create(new CreateDeliveryRequest(orderB.Id, "Address B", driverB.Id, "LEA-2", null, null, null));

        return (orderA, orderB, driverA, driverB);
    }

    [Fact]
    public async Task DeliveryRole_SeesOnlyOwnAssignedDeliveries()
    {
        var db = TestHelpers.CreateDb();
        var (orderA, orderB, driverA, driverB) = await SeedTwoDeliveriesAsync(db);

        var asDriverA = TestHelpers.CreateCurrentUser(role: "Delivery", employeeId: driverA.Id);
        var controllerAsDriverA = new DeliveriesController(db, new AuditService(db, asDriverA), asDriverA);

        var result = await controllerAsDriverA.GetAll(null, null, 1, 20);
        var page = Assert.IsType<OkObjectResult>(result.Result).Value as PagedResult<DeliveryDto>;

        Assert.NotNull(page);
        Assert.Single(page!.Items);
        Assert.Equal(orderA.Id, page.Items[0].SalesOrderId);
        Assert.DoesNotContain(page.Items, d => d.SalesOrderId == orderB.Id);
    }

    [Fact]
    public async Task DeliveryRole_QueryParamCannotWidenAccessToAnotherDriversDeliveries()
    {
        var db = TestHelpers.CreateDb();
        var (_, orderB, driverA, driverB) = await SeedTwoDeliveriesAsync(db);

        var asDriverA = TestHelpers.CreateCurrentUser(role: "Delivery", employeeId: driverA.Id);
        var controllerAsDriverA = new DeliveriesController(db, new AuditService(db, asDriverA), asDriverA);

        // Attempting to widen the result set by passing driverEmployeeId=driverB.Id must be
        // ignored for the Delivery role — the server-side scope always wins over a
        // client-supplied filter.
        var result = await controllerAsDriverA.GetAll(null, driverB.Id, 1, 20);
        var page = Assert.IsType<OkObjectResult>(result.Result).Value as PagedResult<DeliveryDto>;

        Assert.NotNull(page);
        Assert.DoesNotContain(page!.Items, d => d.SalesOrderId == orderB.Id);
    }

    [Fact]
    public async Task DeliveryRole_CannotUpdateStatusOfAnotherDriversDelivery()
    {
        var db = TestHelpers.CreateDb();
        var (_, orderB, driverA, _) = await SeedTwoDeliveriesAsync(db);

        var deliveryBId = await db.Deliveries.Where(d => d.SalesOrderId == orderB.Id).Select(d => d.Id).FirstAsync();

        var asDriverA = TestHelpers.CreateCurrentUser(role: "Delivery", employeeId: driverA.Id);
        var controllerAsDriverA = new DeliveriesController(db, new AuditService(db, asDriverA), asDriverA);

        var result = await controllerAsDriverA.UpdateStatus(deliveryBId, new UpdateDeliveryStatusRequest(DeliveryStatus.OutForDelivery, null));

        Assert.IsType<ForbidResult>(result.Result);
        var unchanged = await db.Deliveries.AsNoTracking().FirstAsync(d => d.Id == deliveryBId);
        Assert.Equal(DeliveryStatus.Assigned, unchanged.Status);
    }

    [Fact]
    public async Task DeliveryRole_CanUpdateStatusOfOwnDelivery()
    {
        var db = TestHelpers.CreateDb();
        var (orderA, _, driverA, _) = await SeedTwoDeliveriesAsync(db);

        var deliveryAId = await db.Deliveries.Where(d => d.SalesOrderId == orderA.Id).Select(d => d.Id).FirstAsync();

        var asDriverA = TestHelpers.CreateCurrentUser(role: "Delivery", employeeId: driverA.Id);
        var controllerAsDriverA = new DeliveriesController(db, new AuditService(db, asDriverA), asDriverA);

        var result = await controllerAsDriverA.UpdateStatus(deliveryAId, new UpdateDeliveryStatusRequest(DeliveryStatus.OutForDelivery, null));

        Assert.IsType<OkObjectResult>(result.Result);
        var updated = await db.Deliveries.AsNoTracking().FirstAsync(d => d.Id == deliveryAId);
        Assert.Equal(DeliveryStatus.OutForDelivery, updated.Status);
    }

    [Fact]
    public async Task AdminAndManager_SeeAllDeliveriesRegardlessOfAssignment()
    {
        var db = TestHelpers.CreateDb();
        await SeedTwoDeliveriesAsync(db);

        var asAdmin = TestHelpers.CreateCurrentUser(role: "Admin");
        var controllerAsAdmin = new DeliveriesController(db, new AuditService(db, asAdmin), asAdmin);
        var adminResult = await controllerAsAdmin.GetAll(null, null, 1, 20);
        var adminPage = Assert.IsType<OkObjectResult>(adminResult.Result).Value as PagedResult<DeliveryDto>;
        Assert.Equal(2, adminPage!.TotalCount);

        var asManager = TestHelpers.CreateCurrentUser(role: "Manager");
        var controllerAsManager = new DeliveriesController(db, new AuditService(db, asManager), asManager);
        var managerResult = await controllerAsManager.GetAll(null, null, 1, 20);
        var managerPage = Assert.IsType<OkObjectResult>(managerResult.Result).Value as PagedResult<DeliveryDto>;
        Assert.Equal(2, managerPage!.TotalCount);
    }

    [Fact]
    public async Task UpdateStatus_RejectsInvalidTransition_DeliveredCannotGoBackToPending()
    {
        // Regression test for a UAT finding: UpdateStatus had no transition guard at all, so
        // any status could be set from any other status — including a Delivered delivery
        // being moved back to Pending, which should never happen once completed.
        var db = TestHelpers.CreateDb();
        var (orderA, _, driverA, _) = await SeedTwoDeliveriesAsync(db);
        var deliveryAId = await db.Deliveries.Where(d => d.SalesOrderId == orderA.Id).Select(d => d.Id).FirstAsync();

        var asAdmin = TestHelpers.CreateCurrentUser(role: "Admin");
        var controller = new DeliveriesController(db, new AuditService(db, asAdmin), asAdmin);

        await controller.UpdateStatus(deliveryAId, new UpdateDeliveryStatusRequest(DeliveryStatus.OutForDelivery, null));
        await controller.UpdateStatus(deliveryAId, new UpdateDeliveryStatusRequest(DeliveryStatus.Delivered, null));

        var invalidResult = await controller.UpdateStatus(deliveryAId, new UpdateDeliveryStatusRequest(DeliveryStatus.Pending, null));

        Assert.IsType<BadRequestObjectResult>(invalidResult.Result);
        var unchanged = await db.Deliveries.AsNoTracking().FirstAsync(d => d.Id == deliveryAId);
        Assert.Equal(DeliveryStatus.Delivered, unchanged.Status);
    }

    [Fact]
    public async Task DeliveryRole_WithNoLinkedEmployee_SeesNoDeliveries()
    {
        var db = TestHelpers.CreateDb();
        await SeedTwoDeliveriesAsync(db);

        // A Delivery-role login that was never linked to an Employee record must not
        // fall back to seeing everything — it should see nothing rather than leak data.
        var unlinked = TestHelpers.CreateCurrentUser(role: "Delivery", employeeId: null);
        var controller = new DeliveriesController(db, new AuditService(db, unlinked), unlinked);
        var result = await controller.GetAll(null, null, 1, 20);
        var page = Assert.IsType<OkObjectResult>(result.Result).Value as PagedResult<DeliveryDto>;

        Assert.Equal(0, page!.TotalCount);
    }
}
