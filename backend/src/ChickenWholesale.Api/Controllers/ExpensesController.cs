using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize(Roles = "Admin,Manager,Cashier")]
public class ExpensesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CurrentUserService _currentUser;

    public ExpensesController(ApplicationDbContext db, AuditService audit, CurrentUserService currentUser)
    {
        _db = db;
        _audit = audit;
        _currentUser = currentUser;
    }

    private static ExpenseDto ToDto(Expense e) => new(
        e.Id, e.CategoryId, e.Category?.Name ?? "", e.Amount, e.Date, e.PaidBy, e.PaymentMethod,
        e.Description ?? "", e.ReceiptReference, e.Notes, e.CreatedAt);

    [HttpGet("categories")]
    public async Task<ActionResult<List<ExpenseCategoryDto>>> GetCategories()
    {
        var cats = await _db.ExpenseCategories.OrderBy(c => c.Name).ToListAsync();
        return Ok(cats.Select(c => new ExpenseCategoryDto(c.Id, c.Name)));
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ExpenseDto>>> GetAll(
        [FromQuery] int? categoryId, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Expenses.Include(e => e.Category).AsQueryable();
        if (categoryId.HasValue) query = query.Where(e => e.CategoryId == categoryId);
        if (from.HasValue) query = query.Where(e => e.Date >= from);
        if (to.HasValue) query = query.Where(e => e.Date <= to);

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(e => e.Date).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<ExpenseDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<ExpenseDto>> Create(CreateExpenseRequest req)
    {
        var expense = new Expense
        {
            CategoryId = req.CategoryId,
            Amount = req.Amount,
            Date = req.Date ?? DateTime.UtcNow,
            PaidBy = req.PaidBy,
            PaymentMethod = req.PaymentMethod,
            Description = req.Description,
            ReceiptReference = req.ReceiptReference,
            Notes = req.Notes,
            CreatedByUserId = _currentUser.UserId
        };
        _db.Expenses.Add(expense);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Expense", expense.Id.ToString(), $"Recorded expense Rs.{expense.Amount} - {expense.Description}");
        await _db.Entry(expense).Reference(e => e.Category).LoadAsync();
        return Ok(ToDto(expense));
    }
}
