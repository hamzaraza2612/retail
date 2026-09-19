using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace ChickenWholesale.Api.Infrastructure;

/// <summary>
/// Every DateTime the app writes is UTC (DateTime.UtcNow), and every DateTime column is
/// Postgres "timestamp with time zone" — but a plain date string coming in from a query
/// parameter (?from=2026-09-19) or a JSON body field parses to DateTimeKind.Unspecified by
/// default, and Npgsql (correctly) refuses to write an Unspecified-kind DateTime into a
/// timestamptz column, throwing at the first query/save that touches it. This bit every
/// date-filterable endpoint in the app (reports, orders, purchases, inventory movements,
/// deliveries) and the new Processing Batch date field — nothing was wrong with the filter
/// logic itself, just the Kind on the value handed to it. Two converters/binders, one for
/// each place a DateTime enters the app, both normalizing to UTC exactly like DateTime.UtcNow
/// already is everywhere else, rather than special-casing every individual controller
/// parameter or column.
/// </summary>
public static class UtcDateTimeBinding
{
    private const DateTimeStyles Styles = DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal;

    public static DateTime ParseAsUtc(string value) =>
        DateTime.Parse(value, CultureInfo.InvariantCulture, Styles);
}

/// <summary>Normalizes [FromQuery]/route-bound DateTime and DateTime? parameters to UTC.</summary>
public class UtcDateTimeModelBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        ArgumentNullException.ThrowIfNull(bindingContext);

        var result = bindingContext.ValueProvider.GetValue(bindingContext.ModelName);
        if (result == ValueProviderResult.None) return Task.CompletedTask;

        bindingContext.ModelState.SetModelValue(bindingContext.ModelName, result);
        var value = result.FirstValue;
        if (string.IsNullOrWhiteSpace(value)) return Task.CompletedTask;

        try
        {
            bindingContext.Result = ModelBindingResult.Success(UtcDateTimeBinding.ParseAsUtc(value));
        }
        catch (FormatException)
        {
            bindingContext.ModelState.TryAddModelError(bindingContext.ModelName, $"'{value}' is not a valid date.");
        }
        return Task.CompletedTask;
    }
}

public class UtcDateTimeModelBinderProvider : IModelBinderProvider
{
    public IModelBinder? GetBinder(ModelBinderProviderContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var type = context.Metadata.ModelType;
        return type == typeof(DateTime) || type == typeof(DateTime?) ? new UtcDateTimeModelBinder() : null;
    }
}

/// <summary>Normalizes JSON request-body DateTime fields to UTC on the way in (e.g.
/// CreateProcessingBatchRequest.ProcessingDate); writes out exactly as the default
/// converter would, since every DateTime we produce is already UTC.</summary>
public class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var value = reader.GetString();
        return string.IsNullOrWhiteSpace(value) ? default : UtcDateTimeBinding.ParseAsUtc(value);
    }

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
        writer.WriteStringValue(DateTime.SpecifyKind(value, DateTimeKind.Utc));
}

public class UtcNullableDateTimeJsonConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        var value = reader.GetString();
        return string.IsNullOrWhiteSpace(value) ? null : UtcDateTimeBinding.ParseAsUtc(value);
    }

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteStringValue(DateTime.SpecifyKind(value.Value, DateTimeKind.Utc));
        else writer.WriteNullValue();
    }
}
