using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Models;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;

    public UsersController(ApplicationDbContext db, AuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static UserDto ToDto(User u) => new(
        u.Id, u.Username, u.Email, u.FullName, u.Role, u.Phone, u.IsActive, u.CreatedAt, u.LastLoginAt,
        u.EmployeeId, u.Employee?.Name);

    private async Task<ActionResult?> ValidateEmployeeLinkAsync(int? employeeId, int? currentUserId)
    {
        if (!employeeId.HasValue) return null;

        var employee = await _db.Employees.FindAsync(employeeId.Value);
        if (employee == null) return BadRequest(new { error = "Employee not found" });

        var alreadyLinkedToOther = await _db.Users
            .AnyAsync(u => u.EmployeeId == employeeId && u.Id != (currentUserId ?? 0));
        if (alreadyLinkedToOther)
            return BadRequest(new { error = $"Employee '{employee.Name}' is already linked to another user account" });

        return null;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetAll()
    {
        var users = await _db.Users.Include(u => u.Employee).OrderBy(u => u.Username).ToListAsync();
        return Ok(users.Select(ToDto));
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Username == req.Username))
            return BadRequest(new { error = "Username already exists" });
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { error = "Email already exists" });

        var linkError = await ValidateEmployeeLinkAsync(req.EmployeeId, currentUserId: null);
        if (linkError != null) return linkError;

        var now = DateTime.UtcNow;
        var user = new User
        {
            Username = req.Username,
            Email = req.Email,
            FullName = req.FullName,
            Role = req.Role,
            Phone = req.Phone,
            EmployeeId = req.EmployeeId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            PasswordChangedAt = now,
            CreatedAt = now,
            IsActive = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "User", user.Id.ToString(), $"Created user {user.Username}");

        await _db.Entry(user).Reference(u => u.Employee).LoadAsync();
        return Ok(ToDto(user));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> Update(int id, UpdateUserRequest req)
    {
        var user = await _db.Users.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound();

        var linkError = await ValidateEmployeeLinkAsync(req.EmployeeId, currentUserId: id);
        if (linkError != null) return linkError;

        user.FullName = req.FullName;
        user.Role = req.Role;
        user.Phone = req.Phone;
        user.IsActive = req.IsActive;
        user.EmployeeId = req.EmployeeId;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "User", user.Id.ToString(), $"Updated user {user.Username}");

        await _db.Entry(user).Reference(u => u.Employee).LoadAsync();
        return Ok(ToDto(user));
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, ChangePasswordRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        // Invalidates every token already issued for this user (see PasswordStampMiddleware) —
        // no separate revocation list needed for the common "reset a compromised password" case.
        user.PasswordChangedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "User", user.Id.ToString(), $"Password reset for {user.Username}");
        return Ok(new { message = "Password updated" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.IsActive = false;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("DEACTIVATE", "User", user.Id.ToString(), $"Deactivated user {user.Username}");
        return Ok(new { message = "User deactivated" });
    }
}
