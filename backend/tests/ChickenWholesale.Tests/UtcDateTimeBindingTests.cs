using ChickenWholesale.Api.Controllers;
using ChickenWholesale.Api.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace ChickenWholesale.Tests;

/// <summary>
/// Regression test for a UAT-discovered blocker: a bare date string ("2026-09-19") from a
/// query parameter or JSON body parses to DateTimeKind.Unspecified by default, and Npgsql
/// refuses to write an Unspecified-kind DateTime into a "timestamp with time zone" column —
/// this broke every date-filterable endpoint (reports, orders, purchases, inventory
/// movements, deliveries) the moment a caller supplied an explicit date instead of relying
/// on the server's own DateTime.UtcNow default. Fixed by UtcDateTimeBinding.ParseAsUtc,
/// wired in via a model binder (query/route values) and JSON converters (request bodies) in
/// Program.cs, rather than special-casing every individual controller parameter.
/// </summary>
public class UtcDateTimeBindingTests
{
    [Fact]
    public void ParseAsUtc_ProducesUtcKind_ForDateOnlyString()
    {
        var parsed = UtcDateTimeBinding.ParseAsUtc("2026-09-19");
        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
        Assert.Equal(new DateTime(2026, 9, 19, 0, 0, 0, DateTimeKind.Utc), parsed);
    }

    [Fact]
    public async Task ReportsController_DailyStock_AcceptsExplicitDate_AgainstRealPostgres()
    {
        var db = TestHelpers.CreateDb();
        await TestHelpers.SeedProductAsync(db);
        var controller = new ReportsController(db);

        // Using the pre-fix DateTime.Parse (DateTimeKind.Unspecified) here would throw
        // Npgsql.NpgsqlException("Cannot write DateTime with Kind=Unspecified...") the
        // moment the query executes — this is the exact failure UAT hit on every
        // date-filterable endpoint.
        var explicitDate = UtcDateTimeBinding.ParseAsUtc("2026-01-01");
        var result = await controller.DailyStock(explicitDate, null);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task ReportsController_DailyProfit_AcceptsExplicitDate_AgainstRealPostgres()
    {
        var db = TestHelpers.CreateDb();
        var controller = new ReportsController(db);

        var explicitDate = UtcDateTimeBinding.ParseAsUtc("2026-01-01");
        var result = await controller.DailyProfit(explicitDate);

        Assert.IsType<OkObjectResult>(result.Result);
    }
}
