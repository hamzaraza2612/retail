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

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetAll()
    {
        var users = await _db.Users.OrderBy(u => u.Username).ToListAsync();
        return Ok(users.Select(u => new UserDto(u.Id, u.Username, u.Email, u.FullName, u.Role, u.Phone, u.IsActive, u.CreatedAt, u.LastLoginAt)));
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Username == req.Username))
            return BadRequest(new { error = "Username already exists" });
        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return BadRequest(new { error = "Email already exists" });

        var user = new User
        {
            Username = req.Username,
            Email = req.Email,
            FullName = req.FullName,
            Role = req.Role,
            Phone = req.Phone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            IsActive = true
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("CREATE", "User", user.Id.ToString(), $"Created user {user.Username}");
        return Ok(new UserDto(user.Id, user.Username, user.Email, user.FullName, user.Role, user.Phone, user.IsActive, user.CreatedAt, user.LastLoginAt));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> Update(int id, UpdateUserRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.FullName = req.FullName;
        user.Role = req.Role;
        user.Phone = req.Phone;
        user.IsActive = req.IsActive;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("UPDATE", "User", user.Id.ToString(), $"Updated user {user.Username}");
        return Ok(new UserDto(user.Id, user.Username, user.Email, user.FullName, user.Role, user.Phone, user.IsActive, user.CreatedAt, user.LastLoginAt));
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, ChangePasswordRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
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
