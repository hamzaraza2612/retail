using ChickenWholesale.Api.Data;
using ChickenWholesale.Api.Models;

namespace ChickenWholesale.Api.Services;

public class AuditService
{
    private readonly ApplicationDbContext _db;
    private readonly CurrentUserService _currentUser;

    public AuditService(ApplicationDbContext db, CurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task LogAsync(string action, string entity, string entityId, string? description = null)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = _currentUser.UserId == 0 ? null : _currentUser.UserId,
            UserName = _currentUser.UserName,
            Action = action,
            Entity = entity,
            EntityId = entityId,
            Description = description,
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }
}
