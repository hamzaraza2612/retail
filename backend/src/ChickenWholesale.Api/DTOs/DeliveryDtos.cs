using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record CreateDeliveryRequest(
    [Required] int SalesOrderId,
    string? DeliveryAddress,
    int? DriverEmployeeId,
    string? Vehicle,
    DateTime? DeliveryDate,
    string? DeliveryTime,
    string? Notes
);

public record UpdateDeliveryStatusRequest([Required] DeliveryStatus Status, string? Notes);

public record UpdateDeliveryRequest(
    int? DriverEmployeeId,
    string? Vehicle,
    DateTime? DeliveryDate,
    string? DeliveryTime,
    string? DeliveryAddress,
    string? Notes
);

public record DeliveryDto(
    int Id, int SalesOrderId, string OrderNumber, int CustomerId, string CustomerName,
    string? DeliveryAddress, int? DriverEmployeeId, string? DriverName, string? Vehicle,
    DateTime? DeliveryDate, string? DeliveryTime, DeliveryStatus Status, string? Notes, DateTime CreatedAt
);
