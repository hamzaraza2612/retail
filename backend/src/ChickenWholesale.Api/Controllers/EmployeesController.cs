using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize(Roles = "Admin,Manager")]
public class EmployeesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly CodeGeneratorService _codeGen;

    public EmployeesController(ApplicationDbContext db, AuditService audit, CodeGeneratorService codeGen)
    {
        _db = db;
        _audit = audit;
        _codeGen = codeGen;
    }

    private static EmployeeDto ToDto(Employee e) => new(
        e.Id, e.EmployeeCode, e.Name, e.Phone, e.CNIC, e.Role, e.Department, e.JoiningDate, e.Salary, e.Status, e.Notes);

    [HttpGet]
    public async Task<ActionResult<PagedResult<EmployeeDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] EmployeeStatus? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.Employees.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(e => e.Name.Contains(search) || e.Phone.Contains(search) || e.EmployeeCode.Contains(search));
        if (status.HasValue) query = query.Where(e => e.Status == status);

        var total = await query.CountAsync();
        var items = await query.OrderBy(e => e.Name).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new PagedResult<EmployeeDto>(items.Select(ToDto).ToList(), total, page, pageSize));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var e = await _db.Employees.FindAsync(id);
        return e == null ? NotFound() : Ok(ToDto(e));
    }

    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeRequest req)
    {
        var e = new Employee
        {
            EmployeeCode = await _codeGen.NextEmployeeCodeAsync(),
            Name = req.Name,
            Phone = req.Phone,
            CNIC = req.CNIC,
            Role = req.Role,
            Department = req.Department,
            JoiningDate = req.JoiningDate ?? DateTime.UtcNow,
            Salary = req.Salary,
            Status = EmployeeStatus.Active,
            Notes = req.Notes
        };
        _db.Employees.Add(e);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "Employee", e.Id.ToString(), $"Created employee {e.Name}");
        return Ok(ToDto(e));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EmployeeDto>> Update(int id, UpdateEmployeeRequest req)
    {
        var e = await _db.Employees.FindAsync(id);
        if (e == null) return NotFound();

        e.Name = req.Name;
        e.Phone = req.Phone;
        e.CNIC = req.CNIC;
        e.Role = req.Role;
        e.Department = req.Department;
        e.Salary = req.Salary;
        e.Status = req.Status;
        e.Notes = req.Notes;
        e.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "Employee", e.Id.ToString(), $"Updated employee {e.Name}");
        return Ok(ToDto(e));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var e = await _db.Employees.FindAsync(id);
        if (e == null) return NotFound();
        e.Status = EmployeeStatus.Inactive;
        e.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DEACTIVATE", "Employee", e.Id.ToString(), $"Deactivated employee {e.Name}");
        return Ok(new { message = "Employee deactivated" });
    }
}
