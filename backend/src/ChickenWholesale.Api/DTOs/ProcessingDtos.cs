using System.ComponentModel.DataAnnotations;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.DTOs;

public record ProcessingInputRequest(
    [Required] int ProductId,
    [Range(0.001, 1_000_000)] decimal Quantity
);

public record ProcessingOutputRequest(
    [Required] int ProductId,
    [Range(0.001, 1_000_000)] decimal Quantity
);

public record CreateProcessingBatchRequest(
    DateTime? ProcessingDate,
    [Required, MinLength(1)] List<ProcessingInputRequest> Inputs,
    List<ProcessingOutputRequest>? Outputs,
    [Range(0, 1_000_000)] decimal WasteQuantity,
    string? WasteReason,
    string? Notes
);

public record UpdateProcessingBatchStatusRequest([Required] ProcessingBatchStatus Status);

public record ProcessingInputDto(int Id, int ProductId, string ProductName, decimal Quantity, UnitOfMeasure Unit, decimal UnitCost, decimal TotalCost);
public record ProcessingOutputDto(int Id, int ProductId, string ProductName, decimal Quantity, UnitOfMeasure Unit, decimal UnitCost, decimal AllocatedCost);

public record ProcessingBatchDto(
    int Id, string BatchNumber, DateTime ProcessingDate, ProcessingBatchStatus Status,
    decimal WasteQuantity, UnitOfMeasure WasteUnit, string? WasteReason, string? Notes,
    DateTime CreatedAt,
    decimal TotalInputQuantity, decimal TotalOutputQuantity, decimal TotalAllocatedCost, decimal? YieldPercent,
    List<ProcessingInputDto> Inputs, List<ProcessingOutputDto> Outputs
);
