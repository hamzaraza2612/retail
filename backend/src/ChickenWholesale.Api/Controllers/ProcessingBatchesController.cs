using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

/// <summary>
/// Chicken cutting/processing: raw material goes in, finished products (plus waste) come
/// out. See BUSINESS_WORKFLOW.md "Processing &amp; Costing" for the full workflow and the
/// weight-based cost allocation formula used at completion.
/// </summary>
[ApiController]
[Route("api/processing-batches")]
[Authorize(Roles = "Admin,Manager,StoreKeeper")]
public class ProcessingBatchesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;
    private readonly InventoryService _inventory;
    private readonly CurrentUserService _currentUser;

    // Two output quantities from a real scale/recipe rarely add back to the input to the
    // 15th decimal place — this is the same "allow a small configurable rounding
    // tolerance" the task brief asks for, applied to the balance check at completion only.
    private const decimal BalanceToleranceKg = 0.01m;

    // Same server-side transition guard pattern as SalesOrdersController/DeliveriesController:
    // Draft has touched no stock yet, so it can freely become Completed or Cancelled;
    // Completed can only be Cancelled (a full, safe reversal — see UpdateStatus); nothing
    // can leave Cancelled, and nothing can re-enter Completed once left.
    private static readonly Dictionary<ProcessingBatchStatus, ProcessingBatchStatus[]> AllowedTransitions = new()
    {
        [ProcessingBatchStatus.Draft] = new[] { ProcessingBatchStatus.Completed, ProcessingBatchStatus.Cancelled },
        [ProcessingBatchStatus.Completed] = new[] { ProcessingBatchStatus.Cancelled },
        [ProcessingBatchStatus.Cancelled] = Array.Empty<ProcessingBatchStatus>(),
    };

    public ProcessingBatchesController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen,
        InventoryService inventory, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
        _inventory = inventory;
        _currentUser = currentUser;
    }

    private static ProcessingBatchDto ToDto(ProcessingBatch b)
    {
        var totalInput = b.Inputs.Sum(i => i.Quantity);
        var totalOutput = b.Outputs.Sum(o => o.Quantity);
        var totalCost = b.Outputs.Sum(o => o.AllocatedCost);
        decimal? yieldPct = totalInput > 0 ? Math.Round(totalOutput / totalInput * 100, 2) : null;

        return new ProcessingBatchDto(
            b.Id, b.BatchNumber, b.ProcessingDate, b.Status,
            b.WasteQuantity, b.WasteUnit, b.WasteReason, b.Notes, b.CreatedAt,
            totalInput, totalOutput, totalCost, yieldPct,
            b.Inputs.Select(i => new ProcessingInputDto(i.Id, i.ProductId, i.Product?.Name ?? "", i.Quantity, i.Unit, i.UnitCost, i.TotalCost)).ToList(),
            b.Outputs.Select(o => new ProcessingOutputDto(o.Id, o.ProductId, o.Product?.Name ?? "", o.Quantity, o.Unit, o.UnitCost, o.AllocatedCost)).ToList()
        );
    }

    private IQueryable<ProcessingBatch> WithIncludes() =>
        _db.ProcessingBatches
            .Include(b => b.Inputs).ThenInclude(i => i.Product)
            .Include(b => b.Outputs).ThenInclude(o => o.Product);

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProcessingBatchDto>>> GetAll(
        [FromQuery] ProcessingBatchStatus? status, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = WithIncludes().AsQueryable();
        if (status.HasValue) query = query.Where(b => b.Status == status);
        if (from.HasValue) query = query.Where(b => b.ProcessingDate >= from);
        if (to.HasValue) query = query.Where(b => b.ProcessingDate <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.ProcessingDate)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<ProcessingBatchDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProcessingBatchDto>> GetById(int id)
    {
        var batch = await WithIncludes().FirstOrDefaultAsync(b => b.Id == id);
        return batch == null ? NotFound() : Ok(ToDto(batch));
    }

    [HttpPost]
    public async Task<ActionResult<ProcessingBatchDto>> Create(CreateProcessingBatchRequest req)
    {
        var batch = new ProcessingBatch
        {
            BatchNumber = await _codeGen.NextProcessingBatchNumberAsync(),
            ProcessingDate = req.ProcessingDate ?? DateTime.UtcNow,
            Status = ProcessingBatchStatus.Draft,
            WasteQuantity = req.WasteQuantity,
            WasteReason = req.WasteReason,
            Notes = req.Notes,
            CreatedByUserId = _currentUser.UserId
        };

        foreach (var inReq in req.Inputs)
        {
            var product = await _db.Products.FindAsync(inReq.ProductId);
            if (product == null) return BadRequest(new { error = $"Product {inReq.ProductId} not found" });
            if (!product.IsActive) return BadRequest(new { error = $"Product '{product.Name}' is deactivated and cannot be used in processing" });
            if (product.ProductType != ProductType.RawMaterial)
                return BadRequest(new { error = $"Product '{product.Name}' is not a raw material and cannot be used as processing input" });

            batch.Inputs.Add(new ProcessingInput { ProductId = product.Id, Quantity = inReq.Quantity, Unit = product.Unit });
            batch.WasteUnit = product.Unit;
        }

        foreach (var outReq in req.Outputs ?? new List<ProcessingOutputRequest>())
        {
            var product = await _db.Products.FindAsync(outReq.ProductId);
            if (product == null) return BadRequest(new { error = $"Product {outReq.ProductId} not found" });
            if (!product.IsActive) return BadRequest(new { error = $"Product '{product.Name}' is deactivated and cannot be a processing output" });
            if (product.ProductType != ProductType.FinishedProduct)
                return BadRequest(new { error = $"Product '{product.Name}' is not a finished product and cannot be a processing output" });

            batch.Outputs.Add(new ProcessingOutput { ProductId = product.Id, Quantity = outReq.Quantity, Unit = product.Unit });
        }

        _db.ProcessingBatches.Add(batch);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "ProcessingBatch", batch.Id.ToString(), $"Created processing batch {batch.BatchNumber} (Draft)");

        var saved = await WithIncludes().FirstAsync(b => b.Id == batch.Id);
        return Ok(ToDto(saved));
    }

    [HttpPut("{id}/status")]
    public async Task<ActionResult<ProcessingBatchDto>> UpdateStatus(int id, UpdateProcessingBatchStatusRequest req)
    {
        var batch = await WithIncludes().FirstOrDefaultAsync(b => b.Id == id);
        if (batch == null) return NotFound();

        if (!AllowedTransitions.TryGetValue(batch.Status, out var allowedNext) || !allowedNext.Contains(req.Status))
            return BadRequest(new { error = $"Cannot change processing batch from {batch.Status} to {req.Status}" });

        var observedStatus = batch.Status;

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Atomically claim this exact transition — see SalesOrdersController for the
            // rationale (protects against a double-click or two workers completing/
            // cancelling the same batch at once).
            var claimed = await _db.ProcessingBatches
                .Where(b => b.Id == id && b.Status == observedStatus)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(b => b.Status, req.Status)
                    .SetProperty(b => b.UpdatedAt, DateTime.UtcNow));

            if (claimed == 0)
            {
                await tx.RollbackAsync();
                return Conflict(new { error = "This processing batch was just updated by another request. Please refresh and try again." });
            }

            if (req.Status == ProcessingBatchStatus.Completed)
            {
                await CompleteAsync(batch);
            }
            else if (req.Status == ProcessingBatchStatus.Cancelled && observedStatus == ProcessingBatchStatus.Completed)
            {
                await ReverseAsync(batch);
            }
            // Cancelling a Draft batch touches no stock at all — nothing further to do.

            batch.Status = req.Status;
            await _db.SaveChangesAsync();
            await _audit.LogAsync("STATUS_CHANGE", "ProcessingBatch", batch.Id.ToString(),
                $"Processing batch {batch.BatchNumber} status -> {req.Status}");
            await tx.CommitAsync();

            var saved = await WithIncludes().FirstAsync(b => b.Id == id);
            return Ok(ToDto(saved));
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Validates the batch balances (input = output + waste, within tolerance), then
    /// atomically consumes the raw material and produces the finished goods, allocating
    /// the raw material's cost across the outputs by weight. See BUSINESS_WORKFLOW.md for
    /// the exact formula. Every stock movement here shares one DB transaction with the
    /// status change (see caller) — either the whole batch completes, or none of it does.
    /// </summary>
    private async Task CompleteAsync(ProcessingBatch batch)
    {
        if (batch.Inputs.Count == 0)
            throw new InvalidOperationException("Cannot complete a processing batch with no input.");

        var totalInput = batch.Inputs.Sum(i => i.Quantity);
        var totalOutput = batch.Outputs.Sum(o => o.Quantity);
        if (totalOutput <= 0)
            throw new InvalidOperationException("Cannot complete a processing batch with no usable output — every input either becomes an output or is waste, and at least one output is required.");

        var difference = totalInput - (totalOutput + batch.WasteQuantity);
        if (Math.Abs(difference) > BalanceToleranceKg)
            throw new InvalidOperationException(
                $"Unbalanced processing batch: input ({totalInput}) must equal output + waste ({totalOutput + batch.WasteQuantity}); difference of {difference} exceeds the {BalanceToleranceKg} tolerance.");

        // Re-check product state at the moment of completion, not just at draft creation —
        // a product could have been deactivated or reclassified in the meantime.
        decimal allocatableCost = 0;
        foreach (var input in batch.Inputs)
        {
            var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == input.ProductId)
                ?? throw new InvalidOperationException($"Product {input.ProductId} no longer exists.");
            if (!product.IsActive)
                throw new InvalidOperationException($"Product '{product.Name}' is deactivated and this batch can no longer be completed.");

            // The application does not implement lot-level/FIFO/weighted-average purchase
            // costing (see BUSINESS_WORKFLOW.md "Costing model — what this is not"), so the
            // raw material's cost basis is its current Product.PurchasePrice, consistent
            // with how the rest of the app already treats that field as the best-known
            // per-unit cost. Captured now (completion time), not at draft creation, so a
            // batch left in Draft for a while still costs at today's price.
            input.UnitCost = product.PurchasePrice;
            input.TotalCost = input.Quantity * input.UnitCost;
            allocatableCost += input.TotalCost;

            await _inventory.ApplyMovementAsync(input.ProductId, -input.Quantity, InventoryMovementType.PROCESSING_OUT,
                "ProcessingBatch", batch.Id, $"Processing batch {batch.BatchNumber}", allowNegative: false, unitCost: input.UnitCost);
        }

        // Weight-based allocation: the batch's total raw-material cost divided evenly per
        // unit of USABLE output (waste carries no cost forward — see BUSINESS_WORKFLOW.md).
        var baseUnitCost = Math.Round(allocatableCost / totalOutput, 4);

        foreach (var output in batch.Outputs)
        {
            var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == output.ProductId)
                ?? throw new InvalidOperationException($"Product {output.ProductId} no longer exists.");
            if (!product.IsActive)
                throw new InvalidOperationException($"Product '{product.Name}' is deactivated and this batch can no longer be completed.");

            output.UnitCost = baseUnitCost;
            output.AllocatedCost = Math.Round(output.Quantity * baseUnitCost, 2);

            await _inventory.ApplyMovementAsync(output.ProductId, output.Quantity, InventoryMovementType.PROCESSING_IN,
                "ProcessingBatch", batch.Id, $"Processing batch {batch.BatchNumber}", allowNegative: true, unitCost: output.UnitCost);

            // The finished product's own reference cost now reflects the latest actual
            // processing cost, the same way Product.PurchasePrice is the "current
            // best-known cost" everywhere else in the app — while the historical figure
            // for THIS batch stays intact on ProcessingOutput.UnitCost above.
            await _db.Products.Where(p => p.Id == output.ProductId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.PurchasePrice, baseUnitCost));
        }
    }

    /// <summary>
    /// Reverses a Completed batch's stock movements exactly once. Restoring the raw
    /// material is always safe (stock only goes up). Removing the finished output is only
    /// safe if none of it has been sold or otherwise consumed yet.
    ///
    /// Finished stock is a fungible pool with no per-batch/lot tracking (see
    /// BUSINESS_WORKFLOW.md "Costing model — what this is not"), so a plain "would this
    /// reversal take current stock negative" check is not sufficient: if another batch's
    /// output of the same product is still sitting in the pool, that unrelated stock can
    /// mask the fact that units from THIS batch were already sold — the reversal would then
    /// succeed while double-counting the raw material (added back as if never processed)
    /// and silently erasing value that already left the building on an invoice. UAT caught
    /// this exact case with two same-day batches both producing Boneless Chicken. So before
    /// touching any stock, explicitly refuse to cancel if any unit of one of this batch's
    /// own output products has left stock (sold, wasted, adjusted out, or consumed by a
    /// later processing batch) since the moment this batch's own output joined the pool —
    /// a deliberately conservative check given there is no lot tracking to be more precise.
    /// </summary>
    private static readonly InventoryMovementType[] OutgoingMovementTypes =
    {
        InventoryMovementType.SALE, InventoryMovementType.ADJUSTMENT_OUT, InventoryMovementType.WASTE,
        InventoryMovementType.RETURN_OUT, InventoryMovementType.PROCESSING_OUT
    };

    private async Task ReverseAsync(ProcessingBatch batch)
    {
        foreach (var output in batch.Outputs)
        {
            var joinedPoolAt = await _db.InventoryTransactions
                .Where(t => t.ProductId == output.ProductId && t.ReferenceType == "ProcessingBatch"
                    && t.ReferenceId == batch.Id && t.MovementType == InventoryMovementType.PROCESSING_IN)
                .Select(t => (DateTime?)t.Date)
                .FirstOrDefaultAsync();

            if (joinedPoolAt == null) continue;

            var soldSince = await _db.InventoryTransactions.AnyAsync(t =>
                t.ProductId == output.ProductId && t.Date >= joinedPoolAt && OutgoingMovementTypes.Contains(t.MovementType));

            if (soldSince)
            {
                var product = await _db.Products.AsNoTracking().FirstAsync(p => p.Id == output.ProductId);
                throw new InvalidOperationException(
                    $"Cannot cancel this processing batch: some of its output ('{product.Name}') has already been sold or otherwise moved out of stock.");
            }
        }

        foreach (var output in batch.Outputs)
        {
            await _inventory.ApplyMovementAsync(output.ProductId, -output.Quantity, InventoryMovementType.ADJUSTMENT_OUT,
                "ProcessingBatchCancel", batch.Id,
                $"Reversal of processing batch {batch.BatchNumber} (cancelled)", allowNegative: false);
        }

        foreach (var input in batch.Inputs)
        {
            await _inventory.ApplyMovementAsync(input.ProductId, input.Quantity, InventoryMovementType.ADJUSTMENT_IN,
                "ProcessingBatchCancel", batch.Id,
                $"Reversal of processing batch {batch.BatchNumber} (cancelled)", allowNegative: true, unitCost: input.UnitCost);
        }
    }
}
