using System.Security.Claims;
using ChickenWholesale.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ChickenWholesale.Api.Middleware;

/// <summary>
/// A JWT alone is stateless: once issued, it stays valid until it expires, even if the
/// account is deactivated or its password is reset in the meantime. This middleware closes
/// that gap without a full token-blacklist: every JWT carries a "pwdTs" claim stamped with
/// the user's PasswordChangedAt at the moment it was issued. On every authenticated request
/// this is compared against the current value in the database (one indexed lookup by
/// primary key); a mismatch — or the account having been deactivated — means the token was
/// issued before a password reset or deactivation, so the request is rejected as
/// unauthenticated rather than trusting a stale token.
/// </summary>
public class PasswordStampMiddleware
{
    private readonly RequestDelegate _next;

    public PasswordStampMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db)
    {
        if (context.User.Identity is { IsAuthenticated: true })
        {
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var stampClaim = context.User.FindFirst("pwdTs")?.Value;

            if (!int.TryParse(userIdClaim, out var userId) || stampClaim == null)
            {
                await RejectAsync(context);
                return;
            }

            var current = await db.Users.AsNoTracking().Where(u => u.Id == userId)
                .Select(u => new { u.IsActive, u.PasswordChangedAt })
                .FirstOrDefaultAsync();

            if (current == null || !current.IsActive || current.PasswordChangedAt.Ticks.ToString() != stampClaim)
            {
                await RejectAsync(context);
                return;
            }
        }

        await _next(context);
    }

    private static async Task RejectAsync(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "Your session is no longer valid. Please sign in again." });
    }
}
