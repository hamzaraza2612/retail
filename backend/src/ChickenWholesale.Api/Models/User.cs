namespace ChickenWholesale.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    /// <summary>
    /// Stamped into every JWT issued for this user. Checked on every authenticated
    /// request (see PasswordStampMiddleware) so that resetting a password — or
    /// deactivating the account — invalidates any already-issued tokens immediately,
    /// without needing a token blacklist.
    /// </summary>
    public DateTime PasswordChangedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optional link to the Employee record this login belongs to. Used to scope a
    /// Delivery-role user to only the deliveries assigned to them (DriverEmployeeId).
    /// Nullable because most roles (Admin/Manager/Sales/Cashier/StoreKeeper) don't need it.
    /// </summary>
    public int? EmployeeId { get; set; }
    public Employee? Employee { get; set; }
}
