namespace ChickenWholesale.Api.DTOs;

public record AuditLogDto(int Id, int? UserId, string? UserName, string Action, string Entity, string? EntityId, DateTime Timestamp, string? Description);
