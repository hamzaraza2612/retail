using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.DTOs;
using ChickenWholesale.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly JwtService _jwt;
    private readonly AuditService _audit;

    public AuthController(ApplicationDbContext db, JwtService jwt, AuditService audit)
    {
        _db = db;
        _jwt = jwt;
        _audit = audit;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
        if (user == null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            return Unauthorized(new { error = "Invalid username or password" });
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var token = _jwt.GenerateToken(user);
        await _audit.LogAsync("LOGIN", "User", user.Id.ToString(), $"{user.Username} logged in");

        return Ok(new LoginResponse(token, user.Id, user.Username, user.FullName, user.Email, user.Role));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value;
        var user = await _db.Users.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Id == int.Parse(idClaim));
        if (user == null) return NotFound();
        return Ok(new UserDto(user.Id, user.Username, user.Email, user.FullName, user.Role, user.Phone, user.IsActive,
            user.CreatedAt, user.LastLoginAt, user.EmployeeId, user.Employee?.Name));
    }
}
